import type { DevEnvironment } from 'vite'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { cleanUrl } from '@vitest/utils/helpers'
import { isAbsolute, join, resolve } from 'pathe'
import { isWindows } from '../utils/env'
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
    const projectWalk = new GraphWalk(graph, this.related, new Set())
    await projectWalk.add([...projectFiles, ...environmentFiles.values()])
    if (projectFiles.some((file) => projectWalk.isAffected(file))) {
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

    const baseWalk = new GraphWalk(graph, this.related, projectMocks)
    await baseWalk.add(specs.filter((spec) => !specMocks.has(spec)).map((spec) => spec.moduleId))

    const affected = await Promise.all(
      specs.map(async (spec) => {
        const environmentFile = environmentFiles.get(spec)
        if (environmentFile && projectWalk.isAffected(environmentFile)) {
          return true
        }
        const mocked = specMocks.get(spec)
        if (!mocked) {
          return baseWalk.isAffected(spec.moduleId)
        }
        const walk = new GraphWalk(graph, this.related, mocked, baseWalk)
        await walk.add([spec.moduleId])
        return walk.isAffected(spec.moduleId)
      }),
    )
    return specs.filter((_, index) => affected[index])
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

  getModule(filepath: string): Promise<ModuleNode | null> {
    let node = this.modules.get(filepath)
    if (!node) {
      node = this.loadModule(filepath)
      this.modules.set(filepath, node)
    }
    return node
  }

  /**
   * Modules that are never loaded when `filepath` hoists its mocks.
   */
  async getMockedModules(filepath: string): Promise<Set<string>> {
    return (await this.getModule(filepath))?.mocked ?? new Set()
  }

  // a module that fails to load is treated as affected, so its tests run and report the error
  private async loadModule(filepath: string): Promise<ModuleNode | null> {
    try {
      return await this.transformModule(filepath)
    } catch {
      return { dependencies: [], mocked: new Set(), failed: true }
    }
  }

  private async transformModule(filepath: string): Promise<ModuleNode | null> {
    const mod = this.environment.moduleGraph.getModuleById(filepath)
    const transformed =
      mod?.transformResult ||
      (await this.resolver.withTransformLimit(() =>
        this.project._transformService.transform(filepath, this.environment),
      ))
    if (!transformed) {
      return null
    }

    const { replaced, redirects } = await resolveStaticMocks(
      this.environment,
      this.project.config,
      filepath,
      getStaticMocks(this.environment, filepath, transformed),
    )
    const dependencies = [...(transformed.deps || []), ...(transformed.dynamicDeps || [])]
      .map((dep) =>
        dep.startsWith('/@fs/')
          ? dep.slice(isWindows ? 5 : 4)
          : join(this.project.config.root, dep),
      )
      .concat(redirects)
      .filter((dep) => this.resolver.isLocalSourceFile(dep))

    return { dependencies, mocked: new Set(Array.from(replaced, (id) => cleanUrl(id))) }
  }
}

/**
 * Walks the module graph from a set of roots without entering the modules that are mocked.
 */
class GraphWalk {
  private importers = new Map<string, Set<string>>()
  private visited = new Set<string>()
  private failed = new Set<string>()
  private _affected: Set<string> | undefined

  constructor(
    private graph: ProjectGraph,
    private related: string[],
    private mocked: Set<string>,
    // a walk that mocks a subset of these modules, so it reaches every module this walk can
    private base?: GraphWalk,
  ) {}

  async add(roots: string[]): Promise<void> {
    await Promise.all(roots.map((root) => this.addModule(root)))
  }

  isAffected(filepath: string): boolean {
    return this.getAffected().has(filepath)
  }

  private async addModule(filepath: string): Promise<void> {
    if (this.visited.has(filepath) || this.mocked.has(filepath)) {
      return
    }
    this.visited.add(filepath)
    if (this.base?.visited.has(filepath) && !this.base.isAffected(filepath)) {
      return
    }

    const node = await this.graph.getModule(filepath)
    if (!node) {
      return
    }
    if (node.failed) {
      this.failed.add(filepath)
    }
    await Promise.all(
      node.dependencies.map(async (dep) => {
        if (this.mocked.has(dep)) {
          return
        }
        let importedBy = this.importers.get(dep)
        if (!importedBy) {
          this.importers.set(dep, (importedBy = new Set()))
        }
        importedBy.add(filepath)
        return this.addModule(dep)
      }),
    )
  }

  private getAffected(): Set<string> {
    if (this._affected) {
      return this._affected
    }
    const affected = new Set<string>([
      ...this.related.filter((file) => !this.mocked.has(file)),
      ...this.failed,
    ])
    const queue = [...affected]
    while (queue.length) {
      const importedBy = this.importers.get(queue.pop()!)
      if (!importedBy) {
        continue
      }
      for (const importer of importedBy) {
        if (!affected.has(importer)) {
          affected.add(importer)
          queue.push(importer)
        }
      }
    }
    this._affected = affected
    return affected
  }
}
