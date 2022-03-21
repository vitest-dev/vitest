import { existsSync, promises as fs } from 'fs'
import { dirname, resolve } from 'pathe'
import type { Vitest } from '../../node'
import type { File, Reporter } from '../../types'
import { getSuites, getTests } from '../../utils'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)
type Milliseconds = number
interface TestResult {
  displayName?: string
  failureMessage?: string | null
  skipped: boolean
  status?: string
  testFilePath?: string
  perfStats: {
    end?: Milliseconds
    runtime?: Milliseconds
    start?: Milliseconds
  }
}

interface AggregatedResult {
  numFailedTests: number
  numFailedTestSuites: number
  numPassedTests: number
  numPassedTestSuites: number
  numPendingTests: number
  numTodoTests: number
  numPendingTestSuites: number
  numTotalTests: number
  numTotalTestSuites: number
  startTime: number
  success: boolean
  testResults: Array<TestResult>
}

export class JsonReporter implements Reporter {
  start = 0
  ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
    this.start = Date.now()
  }

  protected async logTasks(files: File[]) {
    const suites = getSuites(files)
    const numTotalTestSuites = suites.length
    const tests = getTests(files)
    const numTotalTests = tests.length

    const numFailedTestSuites = suites.filter(s => s.result?.error).length
    const numPassedTestSuites = numTotalTestSuites - numFailedTestSuites
    const numPendingTestSuites = suites.filter(s => s.result?.state === 'run').length
    const numFailedTests = tests.filter(t => t.result?.state === 'fail').length
    const numPassedTests = numTotalTests - numFailedTests
    const numPendingTests = tests.filter(t => t.result?.state === 'run').length
    const numTodoTests = tests.filter(t => t.mode === 'todo').length

    const success = numFailedTestSuites === 0 && numFailedTests === 0

    const testResults: Array<TestResult> = tests.map(t => ({
      perfStats: {
        runtime: t.result?.duration,
        start: t.result?.startTime,
        end: t.result?.duration && t.result?.startTime && t.result.duration + t.result.startTime,
      },
      displayName: t.name,
      failureMessage: t.result?.error?.message,
      skipped: t.mode === 'skip',
      status: t.result?.state,
      testFilePath: t.file?.filepath,
    }))

    const result: AggregatedResult = { numTotalTestSuites, numPassedTestSuites, numFailedTestSuites, numPendingTestSuites, numTotalTests, numPassedTests, numFailedTests, numPendingTests, numTodoTests, startTime: this.start, success, testResults }

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
    if (this.ctx.config.outputFile) {
      const reportFile = resolve(this.ctx.config.root, this.ctx.config.outputFile)

      const outputDirectory = dirname(reportFile)
      if (!existsSync(outputDirectory))
        await fs.mkdir(outputDirectory, { recursive: true })

      await fs.writeFile(reportFile, report, 'utf-8')
      this.ctx.log(`JSON report written to ${reportFile}`)
    }
    else {
      this.ctx.log(report)
    }
  }
}
