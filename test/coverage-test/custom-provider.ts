import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import type { AfterSuiteRunMeta, CoverageProvider, CoverageProviderModule, ReportContext, ResolvedCoverageOptions, Vitest } from 'vitest'

import { normalizeFilename } from './coverage-report-tests/utils'

const CustomCoverageProviderModule: CoverageProviderModule = {
  getProvider(): CoverageProvider {
    return new CustomCoverageProvider()
  },

  takeCoverage() {
    return { customCoverage: 'Coverage report passed from workers to main thread' }
  },
}

/**
 * Provider that simply keeps track of the functions that were called
 */
class CustomCoverageProvider implements CoverageProvider {
  name = 'custom-coverage-provider'

  options!: ResolvedCoverageOptions
  calls: Set<string> = new Set()
  transformedFiles: Set<string> = new Set()

  initialize(ctx: Vitest) {
    this.options = ctx.config.coverage

    this.calls.add(`initialized ${ctx ? 'with' : 'without'} context`)
  }

  clean(force: boolean) {
    this.calls.add(`clean ${force ? 'with' : 'without'} force`)
  }

  onBeforeFilesRun() {
    this.calls.add('onBeforeFilesRun')
  }

  onAfterSuiteRun(meta: AfterSuiteRunMeta) {
    this.calls.add(`onAfterSuiteRun with ${JSON.stringify(meta)}`)
  }

  reportCoverage(reportContext?: ReportContext) {
    this.calls.add(`reportCoverage with ${JSON.stringify(reportContext)}`)

    const jsonReport = JSON.stringify({
      calls: Array.from(this.calls.values()),
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
