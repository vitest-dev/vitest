import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './spec'
import { existsSync } from 'node:fs'
import mm from 'micromatch'
import { join, relative, resolve } from 'pathe'
import { isWindows } from '../utils/env'
import { groupFilters, parseFilter } from './cli/filter'
import { GitNotFoundError, IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError } from './errors'

export class VitestSpecifications {
  private readonly _cachedSpecs = new Map<string, TestSpecification[]>()

  constructor(private vitest: Vitest) {}

  public getModuleSpecifications(moduleId: string): TestSpecification[] {
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

  public async globTestSpecifications(filters: string[] = []) {
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

    // Key is file and val sepcifies whether we have matched this file with testLocation
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
      const { VitestGit } = await import('./git')
      const vitestGit = new VitestGit(this.vitest.config.root)
      const related = await vitestGit.findChangedFiles({
        changedSince: this.vitest.config.changed,
      })
      if (!related) {
        process.exitCode = 1
        throw new GitNotFoundError()
      }
      this.vitest.config.related = Array.from(new Set(related))
    }

    const related = this.vitest.config.related
    if (!related) {
      return specs
    }

    const forceRerunTriggers = this.vitest.config.forceRerunTriggers
    if (forceRerunTriggers.length && mm(related, forceRerunTriggers).length) {
      return specs
    }

    // don't run anything if no related sources are found
    // if we are in watch mode, we want to process all tests
    if (!this.vitest.config.watch && !related.length) {
      return []
    }

    const testGraphs = await Promise.all(
      specs.map(async (spec) => {
        const deps = await this.getTestDependencies(spec)
        return [spec, deps] as const
      }),
    )

    const runningTests: TestSpecification[] = []

    for (const [specification, deps] of testGraphs) {
      // if deps or the test itself were changed
      if (related.some(path => path === specification.moduleId || deps.has(path))) {
        runningTests.push(specification)
      }
    }

    return runningTests
  }

  private async getTestDependencies(spec: TestSpecification, deps = new Set<string>()): Promise<Set<string>> {
    const addImports = async (project: TestProject, filepath: string) => {
      if (deps.has(filepath)) {
        return
      }
      deps.add(filepath)

      const mod = project.vite.moduleGraph.getModuleById(filepath)
      const transformed = mod?.ssrTransformResult || await project.vitenode.transformRequest(filepath)
      if (!transformed) {
        return
      }
      const dependencies = [...transformed.deps || [], ...transformed.dynamicDeps || []]
      await Promise.all(dependencies.map(async (dep) => {
        const fsPath = dep.startsWith('/@fs/')
          ? dep.slice(isWindows ? 5 : 4)
          : join(project.config.root, dep)
        if (!fsPath.includes('node_modules') && !deps.has(fsPath) && existsSync(fsPath)) {
          await addImports(project, fsPath)
        }
      }))
    }

    await addImports(spec.project, spec.moduleId)
    deps.delete(spec.moduleId)

    return deps
  }
}
