import type { DevEnvironment, EnvironmentModuleNode } from 'vite'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import type { ModuleDependency, ModulesResolver } from './vcs/vcs'
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
export class AffectedModulesResolver implements ModulesResolver {
  private existsCache = new Map<string, boolean>()
  private transformConcurrency = os.availableParallelism()
  private activeTransforms = 0
  private transformQueue: Array<() => void> = []
  private related: string[] = []
  private affectedBy = new Map<TestSpecification, Set<string>>()
  // set while `getDependencies` walks the graph
  walked: Set<string> | undefined

  constructor(
    private vitest: Vitest,
    private specs: TestSpecification[],
  ) {}

  // the graph is only known after transforming it, so it is walked once without changes
  async getDependencies(): Promise<ModuleDependency[]> {
    this.walked = new Set()
    await this.getAffectedSpecifications([])
    const files = new Set(Array.from(this.walked, (id) => cleanUrl(id)))
    this.walked = undefined
    return Array.from(files, (file) => ({ file }))
  }

  async getAffectedSpecifications(related: string[]): Promise<Map<TestSpecification, Set<string>>> {
    this.related = related
    this.affectedBy = new Map()
    const specs = this.specs
    const configChanges = getChangedFiles(this.vitest.vite.config.configFileDependencies, related)
    if (configChanges.length) {
      this.affect(specs, configChanges)
      return this.affectedBy
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

    await Promise.all(
      Array.from(specsByProject, ([project, projectSpecs]) =>
        this.findAffectedInProject(project, projectSpecs),
      ),
    )
    return this.affectedBy
  }

  private affect(specs: TestSpecification[], files: Iterable<string>): void {
    for (const spec of specs) {
      const affectedBy = this.affectedBy.get(spec)
      if (affectedBy) {
        for (const file of files) {
          affectedBy.add(file)
        }
        continue
      }
      const specFiles = new Set(files)
      if (specFiles.size) {
        this.affectedBy.set(spec, specFiles)
      }
    }
  }

  private async findAffectedInProject(
    project: TestProject,
    specs: TestSpecification[],
  ): Promise<void> {
    const configChanges = getChangedFiles(
      [...project.vite.config.configFileDependencies, ...getEnvFiles(project)],
      this.related,
    )
    if (configChanges.length) {
      this.affect(specs, configChanges)
      return
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
    const vitestChanges = vitestFiles.flatMap((file) => [
      ...(affectedByVitest.roots.get(file) ?? []),
    ])
    if (vitestChanges.length) {
      this.affect(specs, vitestChanges)
      return
    }

    // walk the graph of the environment that runs the test, so the run reuses the transforms
    const related = new Set(this.related)
    const snapshotContext = { config: project.serializedConfig }
    const environments = await Promise.all(specs.map((spec) => this.getViteEnvironment(spec)))
    const specsByEnvironment = new Map<DevEnvironment, TestSpecification[]>()
    specs.forEach((spec, index) => {
      const environmentFile = environmentFiles[index]
      if (environmentFile) {
        this.affect([spec], affectedByVitest.roots.get(environmentFile) ?? [])
      }
      const snapshotFile = this.getSnapshotFile(spec, snapshotContext)
      if (related.has(snapshotFile)) {
        this.affect([spec], [snapshotFile])
      }
      let environmentSpecs = specsByEnvironment.get(environments[index])
      if (!environmentSpecs) {
        specsByEnvironment.set(environments[index], (environmentSpecs = []))
      }
      environmentSpecs.push(spec)
    })

    await Promise.all(
      Array.from(specsByEnvironment, ([environment, environmentSpecs]) =>
        this.findAffectedInEnvironment(project, environment, environmentSpecs),
      ),
    )
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
  ): Promise<void> {
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
    const projectChanges = projectFiles.flatMap((file) => [
      ...(affectedByProjectFiles.roots.get(file) ?? []),
    ])
    if (projectChanges.length) {
      this.affect(specs, projectChanges)
      return
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

    for (const spec of specs) {
      const mocked = specMocks.get(spec)
      this.affect(
        [spec],
        mocked
          ? walk.getChanges(spec.moduleId, mocked, affectedWithoutMocks)
          : (affected.roots.get(spec.moduleId) ?? []),
      )
    }
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

export function getChangedFiles(files: string[], related: string[]): string[] {
  return files.filter((file) => related.includes(file))
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
    public resolver: AffectedModulesResolver,
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
    let failed = false
    // ids keep the query, so `./file.txt?raw` is walked as its own module
    this.environment.moduleGraph.getModuleById(id)?.importedModules.forEach((imported) => {
      // a dynamic import of a missing file can be caught, a static one always fails
      if (isMissingFile(imported) && transformed.deps?.includes(imported.url)) {
        failed = true
      } else if (imported.id && imported.file && this.resolver.isLocalSourceFile(imported.file)) {
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
      failed,
    }
  }
}

// in SSR, Vite keeps an import it can't resolve as is, a bare one can still be loaded by Node
function isMissingFile(mod: EnvironmentModuleNode): boolean {
  return mod.id?.[0] === '.' || mod.meta?.['vite:alias']?.noResolved === true
}

interface AffectedModules {
  // whether each module imports a changed file, by module index
  modules: Uint8Array
  // changed files that each root imports
  roots: Map<string, string[]>
}

/**
 * Walks the module graph once for every root, skipping a module only when every walk that reaches it mocks it.
 */
class GraphWalk {
  private dependencies = new Map<string, string[]>()
  // modules are numbered, so the walk from every changed file only reads arrays
  private indices = new Map<string, number>()
  private modules: string[] = []
  private isRoot: boolean[] = []
  // the importers of a module are a linked list of edges, so no array is created for every module
  private firstImporter: number[] = []
  private importer: number[] = []
  private nextImporter: number[] = []
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
    roots.forEach((root) => {
      this.isRoot[this.getIndex(root)] = true
    })
    await Promise.all(roots.map((root) => this.addModule(root, mocked)))
  }

  // changed files that each root imports through modules that are not in `mocked`
  getAffected(mocked: Set<string>): AffectedModules {
    const count = this.modules.length
    const isMocked = new Uint8Array(count)
    for (const id of mocked) {
      const index = this.indices.get(id)
      if (index !== undefined) {
        isMocked[index] = 1
      }
    }
    const affected: AffectedModules = { modules: new Uint8Array(count), roots: new Map() }
    // the last walk that visited each module
    const visited = new Uint32Array(count)
    const stack: number[] = []
    let walk = 0
    for (const changed of this.changed) {
      const start = this.indices.get(changed)
      if (start === undefined || isMocked[start]) {
        continue
      }
      const file = cleanUrl(changed)
      visited[start] = ++walk
      stack.push(start)
      while (stack.length) {
        const index = stack.pop()!
        affected.modules[index] = 1
        if (this.isRoot[index]) {
          const id = this.modules[index]
          const files = affected.roots.get(id)
          if (files) {
            files.push(file)
          } else {
            affected.roots.set(id, [file])
          }
        }
        for (let edge = this.firstImporter[index]; edge !== -1; edge = this.nextImporter[edge]) {
          const importer = this.importer[edge]
          if (visited[importer] !== walk && !isMocked[importer]) {
            visited[importer] = walk
            stack.push(importer)
          }
        }
      }
    }
    return affected
  }

  // changed files that the root `id` imports without passing through `mocked`,
  // only modules in `affected` can lead to a change
  getChanges(id: string, mocked: Set<string>, affected: AffectedModules): Set<string> {
    const changes = new Set<string>()
    if (!affected.roots.has(id)) {
      return changes
    }
    const visited = new Set([id])
    const stack = [id]
    while (stack.length) {
      const current = stack.pop()!
      if (this.changed.has(current)) {
        changes.add(cleanUrl(current))
      }
      for (const dep of this.dependencies.get(current) ?? []) {
        if (!visited.has(dep) && !mocked.has(dep) && affected.modules[this.getIndex(dep)]) {
          visited.add(dep)
          stack.push(dep)
        }
      }
    }
    return changes
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
    this.graph.resolver.walked?.add(id)
    node.watchedFiles.forEach((file) => this.graph.resolver.walked?.add(file))
    // a file imported with a query is a separate module
    if (node.failed || this.changed.has(cleanUrl(id))) {
      this.changed.add(id)
    }
    // a module is walked again when fewer modules are mocked, its edges are the same
    if (!this.dependencies.has(id)) {
      this.dependencies.set(
        id,
        node.watchedFiles.length ? [...node.dependencies, ...node.watchedFiles] : node.dependencies,
      )
      const index = this.getIndex(id)
      node.watchedFiles.forEach((file) => this.addImporter(file, index))
      node.dependencies.forEach((dep) => this.addImporter(dep, index))
    }
    await Promise.all(
      node.dependencies.map((dep) => (mocked.has(dep) ? undefined : this.addModule(dep, mocked))),
    )
  }

  private getIndex(id: string): number {
    let index = this.indices.get(id)
    if (index === undefined) {
      index = this.modules.push(id) - 1
      this.indices.set(id, index)
      this.isRoot.push(false)
      this.firstImporter.push(-1)
    }
    return index
  }

  private addImporter(id: string, importer: number): void {
    const index = this.getIndex(id)
    this.nextImporter.push(this.firstImporter[index])
    this.firstImporter[index] = this.importer.push(importer) - 1
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
