import { existsSync, promises as fs } from 'fs'
import { dirname, resolve } from 'pathe'
import type { Vitest } from '../../node'
import type { File, Reporter, Suite, Test } from '../../types'
import { getSuites, getTests } from '../../utils'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'
type Milliseconds = number

interface FormattedAssertionResult {
  ancestorTitles: Array<string>
  fullName: string
  // location?: Callsite | null
  status: Status
  title: string
  duration?: Milliseconds | null
}

interface FormattedTestResult {
  message: string
  name: string
  summary: string
  status: 'failed' | 'passed'
  startTime: number
  endTime: number
  // coverage: unknown
  assertionResults: Array<FormattedAssertionResult>
}

interface FormattedTestResults {
  // coverageMap?: CoverageMap | null | undefined
  numFailedTests: number
  numFailedTestSuites: number
  numPassedTests: number
  numPassedTestSuites: number
  numPendingTests: number
  numPendingTestSuites: number
  // numRuntimeErrorTestSuites: number
  numTodoTests: number
  numTotalTests: number
  numTotalTestSuites: number
  // snapshot: SnapshotSummary
  startTime: number
  success: boolean
  testResults: Array<FormattedTestResult>
  // wasInterrupted: boolean
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

    const testResults: Array<FormattedTestResult> = []
    const fileToTestCases = new Map<string, Test[]>()

    for (const test of tests) {
      const file = test.file
      if (file) {
        if (!fileToTestCases.has(file.filepath))
          fileToTestCases.set(file.filepath, [])

        fileToTestCases.get(file.filepath)!.push(test)
      }
    }

    for (const [filepath, tests] of fileToTestCases) {
      testResults.push({
        assertionResults: tests.map((t) => {
          const ancestorTitles = [] as string[]
          let iter: Suite | undefined = t.suite
          while (iter) {
            ancestorTitles.push(iter.name)
            iter = iter.suite
          }
          ancestorTitles.reverse()

          return {
            ancestorTitles,
            fullName: ancestorTitles.length > 0 ? `${ancestorTitles.join(' ')} ${t.name}` : t.name,
            status: t.result?.state,
            title: t.name,
            duration: t.result?.duration,
          } as FormattedAssertionResult
        }),
        status: tests.every(t =>
          t.result?.state === 'pass'
           || t.result?.state === 'skip'
            || t.result?.state === 'todo')
          ? 'passed'
          : 'failed',
        startTime: tests.reduce((prev, next) => Math.min(prev, next.result?.startTime ?? Infinity), Infinity),
        endTime: tests.reduce((prev, next) => Math.max(prev, (next.result?.startTime ?? 0) + (next.result?.duration ?? 0)), 0),
        message: '',
        name: filepath,
        summary: '',
      })
    }

    const result: FormattedTestResults = {
      numTotalTestSuites,
      numPassedTestSuites,
      numFailedTestSuites,
      numPendingTestSuites,
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numPendingTests,
      numTodoTests,
      startTime: this.start,
      success,
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
