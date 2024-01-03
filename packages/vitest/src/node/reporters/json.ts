import { existsSync, promises as fs } from 'node:fs'
import { dirname, resolve } from 'pathe'
import type { Vitest } from '../../node'
import type { File, Reporter, Suite, Task, TaskState } from '../../types'
import { getSuites, getTests } from '../../utils'
import { getOutputFile } from '../../utils/config-helpers'
import { parseErrorStacktrace } from '../../utils/source-map'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)
// the commented-out fields are the missing ones

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'
type Milliseconds = number
interface Callsite { line: number; column: number }
const StatusMap: Record<TaskState, Status> = {
  fail: 'failed',
  only: 'pending',
  pass: 'passed',
  run: 'pending',
  skip: 'skipped',
  todo: 'todo',
}

interface FormattedAssertionResult {
  ancestorTitles: Array<string>
  fullName: string
  status: Status
  title: string
  duration?: Milliseconds | null
  failureMessages: Array<string>
  location?: Callsite | null
}

interface FormattedTestResult {
  message: string
  name: string
  status: 'failed' | 'passed'
  startTime: number
  endTime: number
  assertionResults: Array<FormattedAssertionResult>
  // summary: string
  // coverage: unknown
}

interface FormattedTestResults {
  numFailedTests: number
  numFailedTestSuites: number
  numPassedTests: number
  numPassedTestSuites: number
  numPendingTests: number
  numPendingTestSuites: number
  numTodoTests: number
  numTotalTests: number
  numTotalTestSuites: number
  startTime: number
  success: boolean
  testResults: Array<FormattedTestResult>
  // coverageMap?: CoverageMap | null | undefined
  // numRuntimeErrorTestSuites: number
  // snapshot: SnapshotSummary
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
    const numFailedTestSuites = suites.filter(s => s.result?.errors).length
    const numPassedTestSuites = numTotalTestSuites - numFailedTestSuites
    const numPendingTestSuites = suites.filter(s => s.result?.state === 'run').length
    const numFailedTests = tests.filter(t => t.result?.state === 'fail').length
    const numPassedTests = numTotalTests - numFailedTests
    const numPendingTests = tests.filter(t => t.result?.state === 'run').length
    const numTodoTests = tests.filter(t => t.mode === 'todo').length
    const testResults: Array<FormattedTestResult> = []

    const success = numFailedTestSuites === 0 && numFailedTests === 0

    for (const file of files) {
      const tests = getTests([file])
      let startTime = tests.reduce((prev, next) => Math.min(prev, next.result?.startTime ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY)
      if (startTime === Number.POSITIVE_INFINITY)
        startTime = this.start

      const endTime = tests.reduce((prev, next) => Math.max(prev, (next.result?.startTime ?? 0) + (next.result?.duration ?? 0)), startTime)
      const assertionResults = await Promise.all(tests.map(async (t) => {
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
          status: StatusMap[t.result?.state || t.mode] || 'skipped',
          title: t.name,
          duration: t.result?.duration,
          failureMessages: t.result?.errors?.map(e => e.message) || [],
          location: await this.getFailureLocation(t),
        } as FormattedAssertionResult
      }))

      if (tests.some(t => t.result?.state === 'run')) {
        this.ctx.logger.warn('WARNING: Some tests are still running when generating the JSON report.'
        + 'This is likely an internal bug in Vitest.'
        + 'Please report it to https://github.com/vitest-dev/vitest/issues')
      }

      testResults.push({
        assertionResults,
        startTime,
        endTime,
        status: tests.some(t =>
          t.result?.state === 'fail')
          ? 'failed'
          : 'passed',
        message: file.result?.errors?.[0]?.message ?? '',
        name: file.filepath,
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

    await this.writeReport(JSON.stringify(result))
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
    const outputFile = getOutputFile(this.ctx.config, 'json')

    if (outputFile) {
      const reportFile = resolve(this.ctx.config.root, outputFile)

      const outputDirectory = dirname(reportFile)
      if (!existsSync(outputDirectory))
        await fs.mkdir(outputDirectory, { recursive: true })

      await fs.writeFile(reportFile, report, 'utf-8')
      this.ctx.logger.log(`JSON report written to ${reportFile}`)
    }
    else {
      this.ctx.logger.log(report)
    }
  }

  protected async getFailureLocation(test: Task): Promise<Callsite | undefined> {
    const error = test.result?.errors?.[0]
    if (!error)
      return

    const project = this.ctx.getProjectByTaskId(test.id)
    const stack = parseErrorStacktrace(error, {
      getSourceMap: file => project.getBrowserSourceMapModuleById(file),
      frameFilter: this.ctx.config.onStackTrace,
    })
    const frame = stack[0]
    if (!frame)
      return

    return { line: frame.line, column: frame.column }
  }
}
