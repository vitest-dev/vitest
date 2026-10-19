import type { Vitest } from './core'
import type { TestSpecification } from './test-specification'
import { relative, resolve } from 'pathe'
import pm from 'picomatch'
import { AffectedModulesResolver } from './affected-modules'
import { groupFilters, parseFilter } from './cli/filter'
import { IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError } from './errors'
import { RecordedModulesResolver } from './recorded-modules'

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
    specs.forEach((spec) => this.ensureSpecificationCached(spec))
    return specs
  }

  public async getRelevantTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    return this.filterTestsBySource(await this.globTestSpecifications(filters))
  }

  public async globTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    const files: TestSpecification[] = []
    const dir = process.cwd()
    const parsedFilters = filters.map((f) => parseFilter(f))

    // Require includeTaskLocation when a location filter is passed
    if (
      !this.vitest.config.includeTaskLocation &&
      parsedFilters.some((f) => f.lineNumber !== undefined)
    ) {
      throw new IncludeTaskLocationDisabledError()
    }

    const testLines = groupFilters(
      parsedFilters.map((f) => ({ ...f, filename: resolve(dir, f.filename) })),
    )

    // Key is file and val specifies whether we have matched this file with testLocation
    const testLocHasMatch: { [f: string]: boolean } = {}

    await Promise.all(
      this.vitest.projects.map(async (project) => {
        const { testFiles, typecheckTestFiles } = await project.globTestFiles(
          parsedFilters.map((f) => f.filename),
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
      }),
    )

    Object.entries(testLines).forEach(([filepath, loc]) => {
      if (loc.length !== 0 && !testLocHasMatch[filepath]) {
        throw new LocationFilterFileNotFoundError(relative(dir, filepath))
      }
    })

    return files
  }

  public clearCache(moduleId?: string): void {
    if (moduleId) {
      this._cachedSpecs.delete(moduleId)
    } else {
      this._cachedSpecs.clear()
    }
  }

  public invalidateDocblock(moduleId: string): void {
    this._cachedSpecs.get(moduleId)?.forEach((spec) => {
      spec._docblock = undefined
    })
  }

  private getCachedSpecifications(moduleId: string): TestSpecification[] | undefined {
    return this._cachedSpecs.get(moduleId)
  }

  public ensureSpecificationCached(spec: TestSpecification): TestSpecification[] {
    const file = spec.moduleId
    const specs = this._cachedSpecs.get(file) || []
    const index = specs.findIndex((_s) => _s.project === spec.project && _s.pool === spec.pool)
    if (index === -1) {
      specs.push(spec)
      this._cachedSpecs.set(file, specs)
    } else {
      specs.splice(index, 1, spec)
    }
    return specs
  }

  private async filterTestsBySource(specs: TestSpecification[]): Promise<TestSpecification[]> {
    this.vitest._sourceFilterResult = undefined

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
    const matcher = forceRerunTriggers.length ? pm(forceRerunTriggers, { dot: true }) : undefined
    if (matcher && related.some((file) => matcher(file))) {
      return specs
    }

    // don't run anything if no related sources are found
    // if we are in watch mode, we want to process all tests
    if (!this.vitest.config.watch && !related.length) {
      this.vitest._sourceFilterResult = { affected: 0, total: specs.length }
      return []
    }

    const resolver = this.vitest.config.experimental.recordDependencies
      ? new RecordedModulesResolver(this.vitest, related)
      : new AffectedModulesResolver(this.vitest, related)
    const affectedSpecs = await resolver.resolve(specs)
    this.vitest._sourceFilterResult = { affected: affectedSpecs.length, total: specs.length }
    return affectedSpecs
  }
}
