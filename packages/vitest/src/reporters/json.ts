import type { Vitest } from '../node'
import type { File, Reporter } from '../types'
import { getSuites, getTests } from '../utils'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)
interface TestResult {
  displayName?: string
  failureMessage?: string | null
  skipped: boolean
  status?: string
  testFilePath?: string
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
    this.start = performance.now()
  }

  protected logTasks(files: File[]) {
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
      displayName: t.name,
      failureMessage: t.result?.error?.message,
      skipped: t.result?.state === 'skip',
      status: t.result?.state,
      testFilePath: t.file?.filepath,
    }))

    const result: AggregatedResult = { numTotalTestSuites, numPassedTestSuites, numFailedTestSuites, numPendingTestSuites, numTotalTests, numPassedTests, numFailedTests, numPendingTests, numTodoTests, startTime: this.start, success, testResults }

    this.ctx.log(JSON.stringify(result))
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.logTasks(files)
  }
}
