import type { Vitest } from './core'
import type { TestSpecification } from './test-specification'
import { relative, resolve } from 'pathe'
import pm from 'picomatch'
import { groupFilters, parseFilter } from './cli/filter'
import { IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError } from './errors'
import { createModulesResolver } from './modules-resolver'
import { MtimeVCSProvider } from './vcs/mtime'

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
    const specifications = await this.filterTestsBySource(
      await this.globTestSpecifications(filters),
    )
    if (this.vitest.config.cliOptions.lastFailed) {
      return this.filterFailedTests(specifications)
    }
    return specifications
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

    const resolver = createModulesResolver(this.vitest, specs)

    if (this.vitest.config.changed && !this.vitest.config.related) {
      const related = await this.vitest.vcs.findChangedFiles({
        root: this.vitest.config.root,
        changedSince: this.vitest.config.changed,
        resolver,
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

    const failedSpecs = this.getFailedSpecifications(specs)

    // don't run anything if no related sources are found
    // if we are in watch mode, we want to process all tests
    if (!this.vitest.config.watch && !related.length) {
      this.vitest._sourceFilterResult = {
        affected: failedSpecs.length,
        total: specs.length,
        failed: failedSpecs.length,
      }
      return failedSpecs
    }

    const affected = new Set([
      ...(await resolver.getAffectedSpecifications(related)),
      ...failedSpecs,
    ])
    const affectedSpecs = specs.filter((spec) => affected.has(spec))
    this.vitest._sourceFilterResult = {
      affected: affectedSpecs.length,
      total: specs.length,
      failed: failedSpecs.length,
    }
    return affectedSpecs
  }

  // a failure can have a cause outside the recorded files, so the file runs until it passes
  private getFailedSpecifications(specs: TestSpecification[]): TestSpecification[] {
    if (!this.vitest.config.changed || !(this.vitest.vcs instanceof MtimeVCSProvider)) {
      return []
    }
    return specs.filter((spec) => this.vitest.cache.getTestSpecificationResult(spec)?.failed)
  }

  private filterFailedTests(specs: TestSpecification[]): TestSpecification[] {
    const failed: TestSpecification[] = []
    for (const spec of specs) {
      const result = this.vitest.cache.getTestSpecificationResult(spec)
      if (!result?.failed) {
        continue
      }
      failed.push(
        result.failedTests
          ? spec.project.createSpecification(
              spec.moduleId,
              // "file:line" filters are the only options a globbed specification can have
              { testNames: result.failedTests, testLines: spec.testLines },
              spec.pool,
            )
          : spec,
      )
    }
    this.vitest._failedFilterResult = { selected: failed.length, total: specs.length }
    return failed
  }
}
