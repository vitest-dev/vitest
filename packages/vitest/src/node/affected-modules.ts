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
const clientEnvironments = new Set(['jsdom', 'happy-dom'])
const noMocks = new Set<string>()

interface ModuleNode {
  dependencies: string[]
  // files added by plugins with `addWatchFile`, they are not modules and are never transformed
  watchedFiles: string[]
  mocked: Set<string>
  restored: Set<string>
  failed?: boolean
}

/**
 * Finds test specifications that statically depend on any of the changed files.
 */
export class AffectedModulesResolver {
  private existsCache = new Map<string, boolean>()
  private transformConcurrency = os.availableParallelism()
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

    const affected = await Promise.all(
      Array.from(specsByProject, ([project, projectSpecs]) =>
        this.findAffectedInProject(project, projectSpecs),
      ),
    )
    const affectedSpecs = new Set(affected.flat())
    return specs.filter((spec) => affectedSpecs.has(spec))
  }

  private async findAffectedInProject(
    project: TestProject,
    specs: TestSpecification[],
  ): Promise<TestSpecification[]> {
    if (
      this.dependsOnConfig(project.vite.config.configFileDependencies) ||
      this.dependsOnConfig(getEnvFiles(project))
    ) {
      return specs
    }

    // global setup and environments are loaded by Vitest itself, not by the test's module runner
    const vitestWalk = new GraphWalk(
      new ProjectGraph(project, project.vite.environments.__vitest__, this),
      this.related,
    )
    const vitestFiles = this.filterLocalSourceFiles([
      ...project.config.globalSetup,
      await this.resolveEnvironmentFile(project, project.config.environment),
    ])
    const environmentFiles = await Promise.all(
      specs.map((spec) => this.getSpecificationEnvironmentFile(spec)),
    )
    await vitestWalk.add(
      [...vitestFiles, ...environmentFiles.filter((file) => file != null)],
      noMocks,
    )

    // if global setup or a setup file is changed, run all specs
    const affectedByVitest = vitestWalk.getAffected(noMocks)
    if (vitestFiles.some((file) => affectedByVitest.has(file))) {
      return specs
    }

    // walk the graph of the environment that runs the test, so the run reuses the transforms
    const affected: TestSpecification[] = []
    const related = new Set(this.related)
    const snapshotContext = { config: project.serializedConfig }
    const environments = await Promise.all(specs.map((spec) => this.getViteEnvironment(spec)))
    const specsByEnvironment = new Map<DevEnvironment, TestSpecification[]>()
    specs.forEach((spec, index) => {
      // always run the spec if environment file is updated
      const environmentFile = environmentFiles[index]
      if (
        (environmentFile && affectedByVitest.has(environmentFile)) ||
        related.has(this.getSnapshotFile(spec, snapshotContext))
      ) {
        affected.push(spec)
        return
      }
      let environmentSpecs = specsByEnvironment.get(environments[index])
      if (!environmentSpecs) {
        specsByEnvironment.set(environments[index], (environmentSpecs = []))
      }
      environmentSpecs.push(spec)
    })

    const affectedInEnvironments = await Promise.all(
      Array.from(specsByEnvironment, ([environment, environmentSpecs]) =>
        this.findAffectedInEnvironment(project, environment, environmentSpecs),
      ),
    )
    return [...affected, ...affectedInEnvironments.flat()]
  }

  private getSnapshotFile(spec: TestSpecification, context: object): string {
    const path = this.vitest.snapshot.resolvePath(spec.moduleId, context)
    return resolve(spec.project.config.root, path)
  }

  // mirrors the `viteEnvironment` of the builtin environments, custom ones are only known in the worker
  private async getViteEnvironment(spec: TestSpecification): Promise<DevEnvironment> {
    const environments = spec.project.vite.environments
    if (spec.pool === 'browser') {
      return environments.ssr
    }
    const { environment } = await getSpecificationDocblock(spec)
    return (clientEnvironments.has(environment.name) && environments.client) || environments.ssr
  }

  private async findAffectedInEnvironment(
    project: TestProject,
    environment: DevEnvironment,
    specs: TestSpecification[],
  ): Promise<TestSpecification[]> {
    const graph = new ProjectGraph(project, environment, this)
    const config = project.config

    // setup files are walked without mocks: a mock only applies to the files loaded after it
    const setupFiles = this.filterLocalSourceFiles(config.setupFiles)
    const projectFiles = this.filterLocalSourceFiles([
      ...setupFiles,
      ...config.snapshotSerializers,
      config.runner,
      config.snapshotEnvironment,
      typeof config.diff === 'string' ? config.diff : undefined,
    ])
    const walk = new GraphWalk(graph, this.related)
    await walk.add(projectFiles, noMocks)
    // the project files are fully walked at this point, so later walks can't change the result
    const affectedByProjectFiles = walk.getAffected(noMocks)
    if (projectFiles.some((file) => affectedByProjectFiles.has(file))) {
      return specs
    }

    // mocks from setup files apply to every test file of the project
    const projectMocks = new Set<string>()
    const setupMocks = await Promise.all(setupFiles.map((file) => graph.getMocks(file)))
    setupMocks.forEach(({ mocked }) => mocked.forEach((id) => projectMocks.add(id)))

    const specMocks = new Map<TestSpecification, Set<string>>()
    await Promise.all(
      specs.map(async (spec) => {
        const { mocked, restored } = await graph.getMocks(spec.moduleId)
        if (!mocked.size && !restored.size) {
          return
        }
        const specMocked = new Set([...projectMocks, ...mocked])
        restored.forEach((id) => specMocked.delete(id))
        specMocks.set(spec, specMocked)
      }),
    )

    await Promise.all(
      specs.map((spec) => walk.add([spec.moduleId], specMocks.get(spec) ?? projectMocks)),
    )
    const affected = walk.getAffected(projectMocks)
    // a test can load a module that a setup file mocks, so its walk is not limited by those mocks
    const affectedWithoutMocks = specMocks.size ? walk.getAffected(noMocks) : affected

    return specs.filter((spec) => {
      const mocked = specMocks.get(spec)
      if (!mocked) {
        return affected.has(spec.moduleId)
      }
      return (
        affectedWithoutMocks.has(spec.moduleId) &&
        walk.reachesChange(spec.moduleId, mocked, affectedWithoutMocks)
      )
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

// files loaded into `import.meta.env`, mirrors Vite's `loadEnv`
export function getEnvFiles(project: TestProject): string[] {
  const { envDir, mode } = project.vite.config
  if (typeof envDir !== 'string') {
    return []
  }
  return ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`].map((file) =>
    resolve(envDir, file),
  )
}

/**
 * Transforms every module of a project's Vite environment at most once, no matter how many walks reach it.
 */
class ProjectGraph {
  private modules = new Map<string, Promise<ModuleNode | null>>()

  constructor(
    private project: TestProject,
    private environment: DevEnvironment,
    private resolver: AffectedModulesResolver,
  ) {}

  getModule(id: string): Promise<ModuleNode | null> {
    let node = this.modules.get(id)
    if (!node) {
      node = this.loadModule(id)
      this.modules.set(id, node)
    }
    return node
  }

  /**
   * Modules that are never loaded when `id` hoists its mocks, and modules that `id` loads even if they are mocked.
   */
  async getMocks(id: string): Promise<{ mocked: Set<string>; restored: Set<string> }> {
    const node = await this.getModule(id)
    return { mocked: node?.mocked ?? new Set(), restored: node?.restored ?? new Set() }
  }

  // a module that fails to load is treated as affected, so its tests run and report the error
  private async loadModule(id: string): Promise<ModuleNode | null> {
    try {
      return await this.transformModule(id)
    } catch {
      return {
        dependencies: [],
        watchedFiles: [],
        mocked: new Set(),
        restored: new Set(),
        failed: true,
      }
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

    const { replaced, redirects, restored } = await resolveStaticMocks(
      this.environment,
      this.project.config,
      id,
      getStaticMocks(this.environment, id, transformed),
    )
    // `deps` only has the imports, the other modules were added by plugins with `addWatchFile`
    const imports = new Set([...(transformed.deps || []), ...(transformed.dynamicDeps || [])])
    const dependencies: string[] = []
    const watchedFiles: string[] = []
    // ids keep the query, so `./file.txt?raw` is walked as its own module
    this.environment.moduleGraph.getModuleById(id)?.importedModules.forEach((imported) => {
      if (imported.id && imported.file && this.resolver.isLocalSourceFile(imported.file)) {
        ;(imports.has(imported.url) ? dependencies : watchedFiles).push(imported.id)
      }
    })
    // `vi.importActual` loads the original without importing it
    ;[...redirects, ...restored].forEach((file) => {
      if (this.resolver.isLocalSourceFile(file) && !dependencies.includes(file)) {
        dependencies.push(file)
      }
    })

    return {
      dependencies,
      watchedFiles,
      mocked: new Set(Array.from(replaced, (mockedId) => cleanUrl(mockedId))),
      restored: new Set(Array.from(restored, (restoredId) => cleanUrl(restoredId))),
    }
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
    this.dependencies.set(
      id,
      node.watchedFiles.length ? [...node.dependencies, ...node.watchedFiles] : node.dependencies,
    )
    node.watchedFiles.forEach((file) => this.addImporter(file, id))
    await Promise.all(
      node.dependencies.map((dep) => {
        this.addImporter(dep, id)
        return mocked.has(dep) ? undefined : this.addModule(dep, mocked)
      }),
    )
  }

  private addImporter(id: string, importer: string): void {
    let importedBy = this.importers.get(id)
    if (!importedBy) {
      this.importers.set(id, (importedBy = new Set()))
    }
    importedBy.add(importer)
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
