import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { join, relative, resolve } from 'pathe'
import pm from 'picomatch'
import { isWindows } from '../utils/env'
import { groupFilters, parseFilter } from './cli/filter'
import { IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError } from './errors'

export class VitestSpecifications {
  private readonly _cachedSpecs = new Map<string, TestSpecification[]>()

  constructor(private vitest: Vitest) {}

  public getModuleSpecifications(moduleId: string): TestSpecification[] {
    const _cached = this.getCachedSpecifications(moduleId)
    if (_cached) {
      return _cached
    }

    const specs: TestSpecification[] = []
    for (const project of this.vitest.projects) {
      if (project._isCachedTestFile(moduleId)) {
        specs.push(project.createSpecification(moduleId))
      }
      if (project._isCachedTypecheckFile(moduleId)) {
        specs.push(project.createSpecification(moduleId, [], 'typescript'))
      }
    }
    specs.forEach(spec => this.ensureSpecificationCached(spec))
    return specs
  }

  public async getRelevantTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    return this.filterTestsBySource(
      await this.globTestSpecifications(filters),
    )
  }

  public async globTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    const files: TestSpecification[] = []
    const dir = process.cwd()
    const parsedFilters = filters.map(f => parseFilter(f))

    // Require includeTaskLocation when a location filter is passed
    if (
      !this.vitest.config.includeTaskLocation
      && parsedFilters.some(f => f.lineNumber !== undefined)
    ) {
      throw new IncludeTaskLocationDisabledError()
    }

    const testLines = groupFilters(parsedFilters.map(
      f => ({ ...f, filename: resolve(dir, f.filename) }),
    ))

    // Key is file and val specifies whether we have matched this file with testLocation
    const testLocHasMatch: { [f: string]: boolean } = {}

    await Promise.all(this.vitest.projects.map(async (project) => {
      const { testFiles, typecheckTestFiles } = await project.globTestFiles(
        parsedFilters.map(f => f.filename),
      )

      testFiles.forEach((file) => {
        const lines = testLines[file]
        testLocHasMatch[file] = true

        const spec = project.createSpecification(file, lines)
        this.ensureSpecificationCached(spec)
        files.push(spec)
      })
      typecheckTestFiles.forEach((file) => {
        const lines = testLines[file]
        testLocHasMatch[file] = true

        const spec = project.createSpecification(file, lines, 'typescript')
        this.ensureSpecificationCached(spec)
        files.push(spec)
      })
    }))

    Object.entries(testLines).forEach(([filepath, loc]) => {
      if (loc.length !== 0 && !testLocHasMatch[filepath]) {
        throw new LocationFilterFileNotFoundError(
          relative(dir, filepath),
        )
      }
    })

    return files
  }

  public clearCache(moduleId?: string): void {
    if (moduleId) {
      this._cachedSpecs.delete(moduleId)
    }
    else {
      this._cachedSpecs.clear()
    }
  }

  private getCachedSpecifications(moduleId: string): TestSpecification[] | undefined {
    return this._cachedSpecs.get(moduleId)
  }

  public ensureSpecificationCached(spec: TestSpecification): TestSpecification[] {
    const file = spec.moduleId
    const specs = this._cachedSpecs.get(file) || []
    const index = specs.findIndex(_s => _s.project === spec.project && _s.pool === spec.pool)
    if (index === -1) {
      specs.push(spec)
      this._cachedSpecs.set(file, specs)
    }
    else {
      specs.splice(index, 1, spec)
    }
    return specs
  }

  private async filterTestsBySource(specs: TestSpecification[]): Promise<TestSpecification[]> {
    if (this.vitest.config.changed && !this.vitest.config.related) {
      const related = await this.vitest.vcs.findChangedFiles({
        root: this.vitest.config.root,
        changedSince: this.vitest.config.changed,
      })
      this.vitest.config.related = Array.from(new Set(related))
    }

    const related = this.vitest.config.related
    if (!related) {
      return specs
    }

    const forceRerunTriggers = this.vitest.config.forceRerunTriggers
    const matcher = forceRerunTriggers.length ? pm(forceRerunTriggers) : undefined
    if (matcher && related.some(file => matcher(file))) {
      return specs
    }

    // don't run anything if no related sources are found
    // if we are in watch mode, we want to process all tests
    if (!this.vitest.config.watch && !related.length) {
      return []
    }

    // The module graph, and so the dependency edges, are per project.
    const specsByProject = new Map<TestProject, TestSpecification[]>()
    for (const spec of specs) {
      let projectSpecs = specsByProject.get(spec.project)
      if (!projectSpecs) {
        specsByProject.set(spec.project, projectSpecs = [])
      }
      projectSpecs.push(spec)
    }

    const affectedByProject = new Map<TestProject, Set<string>>()
    for (const [project, projectSpecs] of specsByProject) {
      affectedByProject.set(
        project,
        await this.getAffectedModules(project, projectSpecs, related),
      )
    }

    return specs.filter(spec => affectedByProject.get(spec.project)!.has(spec.moduleId))
  }

  /**
   * Returns every module in `project` that transitively imports one of `related`.
   *
   * Expands each module's imports at most once into a shared reverse-edge map,
   * then walks that map backwards from the changed files.
   */
  private async getAffectedModules(
    project: TestProject,
    specs: TestSpecification[],
    related: string[],
  ): Promise<Set<string>> {
    const importers = new Map<string, Set<string>>()
    const visited = new Set<string>()
    const existsCache = new Map<string, boolean>()

    // limit concurrency to lower peak memory usage on large graphs
    const TRANSFORM_CONCURRENCY = os.availableParallelism?.() ?? os.cpus().length
    let active = 0
    const waiters: Array<() => void> = []
    const withLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
      if (active >= TRANSFORM_CONCURRENCY) {
        await new Promise<void>(resolve => waiters.push(resolve))
      }
      active++
      try {
        return await fn()
      }
      finally {
        active--
        waiters.shift()?.()
      }
    }

    const cachedExists = (filepath: string): boolean => {
      const cached = existsCache.get(filepath)
      if (cached !== undefined) {
        return cached
      }
      const result = existsSync(filepath)
      existsCache.set(filepath, result)
      return result
    }

    const addImports = async (filepath: string) => {
      // `visited` is shared by every spec in the project, so a module is
      // expanded once per run instead of once per test file that reaches it.
      if (visited.has(filepath)) {
        return
      }
      visited.add(filepath)

      const environment = project.vite.environments.ssr
      const mod = environment.moduleGraph.getModuleById(filepath)
      const transformed = mod?.transformResult || await withLimit(() => environment.transformRequest(filepath))
      if (!transformed) {
        return
      }
      const dependencies = [...transformed.deps || [], ...transformed.dynamicDeps || []]
      await Promise.all(dependencies.map(async (dep) => {
        const fsPath = dep.startsWith('/@fs/')
          ? dep.slice(isWindows ? 5 : 4)
          : join(project.config.root, dep)
        if (fsPath.includes('node_modules') || !cachedExists(fsPath)) {
          return
        }
        let importedBy = importers.get(fsPath)
        if (!importedBy) {
          importers.set(fsPath, importedBy = new Set())
        }
        importedBy.add(filepath)
        await addImports(fsPath)
      }))
    }

    await Promise.all(specs.map(spec => addImports(spec.moduleId)))

    const affected = new Set<string>(related)
    const queue = [...related]
    while (queue.length) {
      const importedBy = importers.get(queue.pop()!)
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

    return affected
  }
}
