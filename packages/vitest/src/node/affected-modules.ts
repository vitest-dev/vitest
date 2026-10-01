import type { DevEnvironment } from 'vite'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { cleanUrl } from '@vitest/utils/helpers'
import { isAbsolute, resolve } from 'pathe'
import { getSpecificationDocblock } from '../utils/test-helpers'
import { getStaticMocks, resolveStaticMocks } from './environments/staticMocks'

const builtinEnvironments = new Set(['node', 'jsdom', 'happy-dom', 'edge-runtime'])

interface ModuleNode {
  dependencies: string[]
  mocked: Set<string>
  failed?: boolean
}

/**
 * Finds test specifications that statically depend on any of the changed files.
 */
export class AffectedModulesResolver {
  private existsCache = new Map<string, boolean>()
  private transformConcurrency = os.availableParallelism?.() ?? os.cpus().length
  private activeTransforms = 0
  private transformQueue: Array<() => void> = []

  constructor(
    private vitest: Vitest,
    private related: string[],
  ) {}

  async resolve(specs: TestSpecification[]): Promise<TestSpecification[]> {
    if (this.dependsOnConfig(this.vitest.vite.config.configFileDependencies)) {
      return specs
    }

    // the module graph, and so the dependency edges, are per project
    const specsByProject = new Map<TestProject, TestSpecification[]>()
    for (const spec of specs) {
      let projectSpecs = specsByProject.get(spec.project)
      if (!projectSpecs) {
        specsByProject.set(spec.project, (projectSpecs = []))
      }
      projectSpecs.push(spec)
    }

    const affectedSpecs = new Set<TestSpecification>()
    for (const [project, projectSpecs] of specsByProject) {
      const affected = await this.resolveProject(project, projectSpecs)
      affected.forEach((spec) => affectedSpecs.add(spec))
    }
    return specs.filter((spec) => affectedSpecs.has(spec))
  }

  private async resolveProject(
    project: TestProject,
    specs: TestSpecification[],
  ): Promise<TestSpecification[]> {
    if (this.dependsOnConfig(project.vite.config.configFileDependencies)) {
      return specs
    }

    const graph = new ProjectGraph(project, this)
    const config = project.config

    // setup files are walked without mocks: a mock only applies to the files loaded after it
    const setupFiles = this.filterLocalSourceFiles(config.setupFiles)
    const projectFiles = this.filterLocalSourceFiles([
      ...setupFiles,
      ...config.globalSetup,
      ...config.snapshotSerializers,
      config.runner,
      config.snapshotEnvironment,
      typeof config.diff === 'string' ? config.diff : undefined,
      await this.resolveEnvironmentFile(project, config.environment),
    ])
    const environmentFiles = new Map<TestSpecification, string>()
    await Promise.all(
      specs.map(async (spec) => {
        const file = await this.getSpecificationEnvironmentFile(spec)
        if (file) {
          environmentFiles.set(spec, file)
        }
      }),
    )
    const walk = new GraphWalk(graph, this.related)
    const noMocks = new Set<string>()
    await walk.add([...projectFiles, ...environmentFiles.values()], noMocks)
    // the project files are fully walked at this point, so later walks can't change the result
    const affectedWithoutMocks = walk.getAffected(noMocks)
    if (projectFiles.some((file) => affectedWithoutMocks.has(file))) {
      return specs
    }

    // mocks from setup files apply to every test file of the project
    const projectMocks = new Set<string>()
    for (const file of setupFiles) {
      const mocked = await graph.getMockedModules(file)
      mocked.forEach((id) => projectMocks.add(id))
    }

    const specMocks = new Map<TestSpecification, Set<string>>()
    await Promise.all(
      specs.map(async (spec) => {
        const mocked = await graph.getMockedModules(spec.moduleId)
        if (mocked.size) {
          specMocks.set(spec, new Set([...projectMocks, ...mocked]))
        }
      }),
    )

    await Promise.all(
      specs.map((spec) => walk.add([spec.moduleId], specMocks.get(spec) ?? projectMocks)),
    )
    const affected = walk.getAffected(projectMocks)

    return specs.filter((spec) => {
      const environmentFile = environmentFiles.get(spec)
      if (environmentFile && affectedWithoutMocks.has(environmentFile)) {
        return true
      }
      if (!affected.has(spec.moduleId)) {
        return false
      }
      const mocked = specMocks.get(spec)
      return !mocked || walk.reachesChange(spec.moduleId, mocked, affected)
    })
  }

  private dependsOnConfig(configDependencies: string[] | undefined): boolean {
    return !!configDependencies?.some((file) => this.related.includes(file))
  }

  private filterLocalSourceFiles(files: (string | null | undefined)[]): string[] {
    return files.filter((file): file is string => !!file && this.isLocalSourceFile(file))
  }

  private async getSpecificationEnvironmentFile(spec: TestSpecification): Promise<string | null> {
    if (spec.pool === 'browser') {
      return null
    }
    const { environment } = await getSpecificationDocblock(spec)
    if (environment.name === spec.project.config.environment) {
      return null
    }
    const file = await this.resolveEnvironmentFile(spec.project, environment.name)
    return file && this.isLocalSourceFile(file) ? file : null
  }

  // mirrors how the environment is loaded in the worker
  private async resolveEnvironmentFile(project: TestProject, name: string): Promise<string | null> {
    if (builtinEnvironments.has(name)) {
      return null
    }
    const root = project.config.root
    if (name[0] === '.' || isAbsolute(name)) {
      return resolve(root, name)
    }
    const resolved = await project.vite.environments.__vitest__.pluginContainer
      .resolveId(`vitest-environment-${name}`, undefined)
      .catch(() => null)
    return resolved ? cleanUrl(resolved.id) : resolve(root, name)
  }

  // an existing file outside of node_modules, dependency changes are not tracked
  isLocalSourceFile(filepath: string): boolean {
    if (filepath.includes('node_modules')) {
      return false
    }
    const cached = this.existsCache.get(filepath)
    if (cached !== undefined) {
      return cached
    }
    const exists = existsSync(filepath)
    this.existsCache.set(filepath, exists)
    return exists
  }

  // limit concurrency to lower peak memory usage on large graphs
  async withTransformLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeTransforms >= this.transformConcurrency) {
      await new Promise<void>((resolve) => this.transformQueue.push(resolve))
    }
    this.activeTransforms++
    try {
      return await fn()
    } finally {
      this.activeTransforms--
      this.transformQueue.shift()?.()
    }
  }
}

/**
 * Transforms every module of a project at most once, no matter how many walks reach it.
 */
class ProjectGraph {
  private modules = new Map<string, Promise<ModuleNode | null>>()
  private environment: DevEnvironment

  constructor(
    private project: TestProject,
    private resolver: AffectedModulesResolver,
  ) {
    this.environment = project.vite.environments.ssr
  }

  getModule(id: string): Promise<ModuleNode | null> {
    let node = this.modules.get(id)
    if (!node) {
      node = this.loadModule(id)
      this.modules.set(id, node)
    }
    return node
  }

  /**
   * Modules that are never loaded when `id` hoists its mocks.
   */
  async getMockedModules(id: string): Promise<Set<string>> {
    return (await this.getModule(id))?.mocked ?? new Set()
  }

  // a module that fails to load is treated as affected, so its tests run and report the error
  private async loadModule(id: string): Promise<ModuleNode | null> {
    try {
      return await this.transformModule(id)
    } catch {
      return { dependencies: [], mocked: new Set(), failed: true }
    }
  }

  private async transformModule(id: string): Promise<ModuleNode | null> {
    const mod = this.environment.moduleGraph.getModuleById(id)
    const transformed =
      mod?.transformResult ||
      (await this.resolver.withTransformLimit(() =>
        this.project._transformService.transform(id, this.environment),
      ))
    if (!transformed) {
      return null
    }

    const { replaced, redirects } = await resolveStaticMocks(
      this.environment,
      this.project.config,
      id,
      getStaticMocks(this.environment, id, transformed),
    )
    // ids keep the query, so `./file.txt?raw` is walked as its own module
    const node = this.environment.moduleGraph.getModuleById(id)
    const dependencies: string[] = []
    node?.importedModules.forEach((imported) => {
      if (imported.id && imported.file && this.resolver.isLocalSourceFile(imported.file)) {
        dependencies.push(imported.id)
      }
    })
    redirects.forEach((file) => {
      if (this.resolver.isLocalSourceFile(file)) {
        dependencies.push(file)
      }
    })

    return { dependencies, mocked: new Set(Array.from(replaced, (mockedId) => cleanUrl(mockedId))) }
  }
}

/**
 * Walks the module graph once for every root, skipping a module only when every walk that reaches it mocks it.
 */
class GraphWalk {
  private dependencies = new Map<string, string[]>()
  private importers = new Map<string, Set<string>>()
  // modules mocked by every root that reaches the module, so they are not walked from it
  private mockedByAll = new Map<string, Set<string>>()
  private changed: Set<string>

  constructor(
    private graph: ProjectGraph,
    related: string[],
  ) {
    this.changed = new Set(related)
  }

  async add(roots: string[], mocked: Set<string>): Promise<void> {
    await Promise.all(roots.map((root) => this.addModule(root, mocked)))
  }

  // modules that import a changed file through modules that are not in `mocked`
  getAffected(mocked: Set<string>): Set<string> {
    const affected = new Set<string>()
    for (const id of this.changed) {
      if (!mocked.has(id)) {
        affected.add(id)
      }
    }
    const queue = [...affected]
    while (queue.length) {
      const importedBy = this.importers.get(queue.pop()!)
      if (!importedBy) {
        continue
      }
      for (const importer of importedBy) {
        if (!affected.has(importer) && !mocked.has(importer)) {
          affected.add(importer)
          queue.push(importer)
        }
      }
    }
    return affected
  }

  // whether `id` imports a changed file without passing through `mocked`,
  // only modules in `affected` can lead to a change
  reachesChange(id: string, mocked: Set<string>, affected: Set<string>): boolean {
    const visited = new Set([id])
    const stack = [id]
    while (stack.length) {
      const current = stack.pop()!
      if (this.changed.has(current)) {
        return true
      }
      for (const dep of this.dependencies.get(current) ?? []) {
        if (affected.has(dep) && !mocked.has(dep) && !visited.has(dep)) {
          visited.add(dep)
          stack.push(dep)
        }
      }
    }
    return false
  }

  private async addModule(id: string, mocked: Set<string>): Promise<void> {
    const previous = this.mockedByAll.get(id)
    if (previous) {
      if (isSubset(previous, mocked)) {
        return
      }
      mocked = new Set([...previous].filter((mockedId) => mocked.has(mockedId)))
    }
    this.mockedByAll.set(id, mocked)

    const node = await this.graph.getModule(id)
    if (!node) {
      return
    }
    // a file imported with a query is a separate module
    if (node.failed || this.changed.has(cleanUrl(id))) {
      this.changed.add(id)
    }
    this.dependencies.set(id, node.dependencies)
    await Promise.all(
      node.dependencies.map((dep) => {
        let importedBy = this.importers.get(dep)
        if (!importedBy) {
          this.importers.set(dep, (importedBy = new Set()))
        }
        importedBy.add(id)
        return mocked.has(dep) ? undefined : this.addModule(dep, mocked)
      }),
    )
  }
}

function isSubset(subset: Set<string>, set: Set<string>): boolean {
  for (const item of subset) {
    if (!set.has(item)) {
      return false
    }
  }
  return true
}
