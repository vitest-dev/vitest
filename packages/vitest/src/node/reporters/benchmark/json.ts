import { existsSync, promises as fs } from 'fs'
import { dirname, resolve } from 'pathe'
import type { Vitest } from '../../../node'
import type { BenchTaskResult, File, Reporter } from '../../../types'
import { getSuites, getTests } from '../../../utils'
import { getOutputFile } from '../../../utils/config-helpers'

interface FormattedTestResults {
  numTotalTests: number
  numTotalTestSuites: number
  testResults: Record<string, BenchTaskResult[]>
}

export class JsonReporter implements Reporter {
  start = 0
  ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
  }

  protected async logTasks(files: File[]) {
    const suites = getSuites(files)
    const numTotalTestSuites = suites.length
    const tests = getTests(files)
    const numTotalTests = tests.length
    const testResults: Record<string, BenchTaskResult[]> = {}

    for (const file of files) {
      const tests = getTests([file])
      for (const test of tests) {
        const res = test.result!.benchmark!
        res.samples = null as any
        testResults[test.suite.name] = (testResults[test.suite.name] || []).concat(res)
      }

      // test.suite.name
      if (tests.some(t => t.result?.state === 'run')) {
        this.ctx.logger.warn('WARNING: Some tests are still running when generating the markdown report.'
        + 'This is likely an internal bug in Vitest.'
        + 'Please report it to https://github.com/vitest-dev/vitest/issues')
      }
    }

    const result: FormattedTestResults = {
      numTotalTestSuites,
      numTotalTests,
      testResults,
    }

    await this.writeReport(JSON.stringify(result, null, 2))
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    await this.logTasks(files)
  }

  /**
   * Writes the report to an output file if specified in the config,
   * or logs it to the console otherwise.
   * @param report
   */
  async writeReport(report: string) {
    const outputFile = getOutputFile(this.ctx, 'json')

    if (outputFile) {
      const reportFile = resolve(this.ctx.config.root, outputFile)

      const outputDirectory = dirname(reportFile)
      if (!existsSync(outputDirectory))
        await fs.mkdir(outputDirectory, { recursive: true })

      await fs.writeFile(reportFile, report, 'utf-8')
      this.ctx.logger.log(`markdown report written to ${reportFile}`)
    }
    else {
      this.ctx.logger.log(report)
    }
  }
}
