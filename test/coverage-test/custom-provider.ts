import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AfterSuiteRunMeta, CoverageProvider, CoverageProviderModule, ReportContext, ResolvedCoverageOptions, Vitest } from 'vitest'

import { normalizeFilename } from './coverage-report-tests/utils'

const CustomCoverageProviderModule: CoverageProviderModule = {
  getProvider(): CoverageProvider {
    return new CustomCoverageProvider()
  },

  takeCoverage() {
    // @ts-expect-error -- untyped
    globalThis.CUSTOM_PROVIDER_TAKE_COVERAGE = true

    // @ts-expect-error -- untyped
    if (!globalThis.CUSTOM_PROVIDER_START_COVERAGE)
      throw new Error('takeCoverage was called before startCoverage!')

    return { customCoverage: 'Coverage report passed from workers to main thread' }
  },

  startCoverage() {
    // @ts-expect-error -- untyped
    globalThis.CUSTOM_PROVIDER_START_COVERAGE = true
  },

  stopCoverage() {
    // @ts-expect-error -- untyped
    if (!globalThis.CUSTOM_PROVIDER_START_COVERAGE)
      throw new Error('stopCoverage was called before startCoverage!')

    // @ts-expect-error -- untyped
    if (!globalThis.CUSTOM_PROVIDER_TAKE_COVERAGE)
      throw new Error('stopCoverage was called before takeCoverage!')
  },
}

/**
 * Provider that simply keeps track of the functions that were called
 */
class CustomCoverageProvider implements CoverageProvider {
  name = 'custom-coverage-provider'

  options!: ResolvedCoverageOptions
  calls: Set<string> = new Set()
  coverageReports: Set<string> = new Set()
  transformedFiles: Set<string> = new Set()

  initialize(ctx: Vitest) {
    this.options = ctx.config.coverage

    this.calls.add(`initialized ${ctx ? 'with' : 'without'} context`)
  }

  clean(force: boolean) {
    this.calls.add(`clean ${force ? 'with' : 'without'} force`)
  }

  onAfterSuiteRun(meta: AfterSuiteRunMeta) {
    // Do not include coverage info here, as order of tests is not guaranteed
    this.calls.add('onAfterSuiteRun')

    // Keep coverage info separate from calls and ignore its order
    this.coverageReports.add(JSON.stringify({
      ...meta,

      // Project name keeps changing so let's simply check that its present
      projectName: meta.projectName && typeof meta.projectName === 'string',
    }))
  }

  reportCoverage(reportContext?: ReportContext) {
    this.calls.add(`reportCoverage with ${JSON.stringify(reportContext)}`)

    const jsonReport = JSON.stringify({
      calls: Array.from(this.calls.values()),
      coverageReports: Array.from(this.coverageReports.values()).sort(),
      transformedFiles: Array.from(this.transformedFiles.values()).sort(),
    }, null, 2)

    if (existsSync('./coverage'))
      rmSync('./coverage', { maxRetries: 10, recursive: true })

    mkdirSync('./coverage')
    writeFileSync('./coverage/custom-coverage-provider-report.json', jsonReport, 'utf-8')
  }

  onFileTransform(code: string, id: string) {
    const filename = normalizeFilename(id).split('?')[0]

    if (/\/src\//.test(filename))
      this.transformedFiles.add(filename)

    return { code }
  }

  resolveOptions(): ResolvedCoverageOptions {
    this.calls.add('resolveOptions')

    return this.options
  }
}

export default CustomCoverageProviderModule
