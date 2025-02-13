import type { File, Suite, TaskMeta, TaskState } from '@vitest/runner'
import type { SnapshotSummary } from '@vitest/snapshot'
import type { CoverageMap } from 'istanbul-lib-coverage'
import type { Vitest } from '../core'
import type { Reporter } from '../types/reporter'
import { existsSync, promises as fs } from 'node:fs'
import { getSuites, getTests } from '@vitest/runner/utils'
import { dirname, resolve } from 'pathe'
import { getOutputFile } from '../../utils/config-helpers'

// for compatibility reasons, the reporter produces a JSON similar to the one produced by the Jest JSON reporter
// the following types are extracted from the Jest repository (and simplified)
// the commented-out fields are the missing ones

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'
type Milliseconds = number
interface Callsite {
  line: number
  column: number
}

const StatusMap: Record<TaskState, Status> = {
  fail: 'failed',
  only: 'pending',
  pass: 'passed',
  run: 'pending',
  skip: 'skipped',
  todo: 'todo',
  queued: 'pending',
}

export interface JsonAssertionResult {
  ancestorTitles: Array<string>
  fullName: string
  status: Status
  title: string
  meta: TaskMeta
  duration?: Milliseconds | null
  failureMessages: Array<string> | null
  location?: Callsite | null
}

export interface JsonTestResult {
  message: string
  name: string
  status: 'failed' | 'passed'
  startTime: number
  endTime: number
  assertionResults: Array<JsonAssertionResult>
  // summary: string
  // coverage: unknown
}

export interface JsonTestResults {
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
  testResults: Array<JsonTestResult>
  snapshot: SnapshotSummary
  coverageMap?: CoverageMap | null | undefined
  // numRuntimeErrorTestSuites: number
  // wasInterrupted: boolean
}

export interface JsonOptions {
  outputFile?: string
}

export class JsonReporter implements Reporter {
  start = 0
  ctx!: Vitest
  options: JsonOptions

  constructor(options: JsonOptions) {
    this.options = options
  }

  onInit(ctx: Vitest): void {
    this.ctx = ctx
    this.start = Date.now()
  }

  protected async logTasks(files: File[], coverageMap?: CoverageMap | null): Promise<JsonTestResults> {
    const suites = getSuites(files)
    const numTotalTestSuites = suites.length
    const tests = getTests(files)
    const numTotalTests = tests.length

    const numFailedTestSuites = suites.filter(s => s.result?.state === 'fail').length
    const numPendingTestSuites = suites.filter(
      s => s.result?.state === 'run' || s.result?.state === 'queued' || s.mode === 'todo',
    ).length
    const numPassedTestSuites = numTotalTestSuites - numFailedTestSuites - numPendingTestSuites

    const numFailedTests = tests.filter(
      t => t.result?.state === 'fail',
    ).length
    const numPassedTests = tests.filter(t => t.result?.state === 'pass').length
    const numPendingTests = tests.filter(
      t => t.result?.state === 'run' || t.result?.state === 'queued' || t.mode === 'skip' || t.result?.state === 'skip',
    ).length
    const numTodoTests = tests.filter(t => t.mode === 'todo').length
    const testResults: Array<JsonTestResult> = []

    const success = !!(files.length > 0 || this.ctx.config.passWithNoTests) && numFailedTestSuites === 0 && numFailedTests === 0

    for (const file of files) {
      const tests = getTests([file])
      let startTime = tests.reduce(
        (prev, next) =>
          Math.min(prev, next.result?.startTime ?? Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY,
      )
      if (startTime === Number.POSITIVE_INFINITY) {
        startTime = this.start
      }

      const endTime = tests.reduce(
        (prev, next) =>
          Math.max(
            prev,
            (next.result?.startTime ?? 0) + (next.result?.duration ?? 0),
          ),
        startTime,
      )
      const assertionResults = tests.map((t) => {
        const ancestorTitles: string[] = []
        let iter: Suite | undefined = t.suite
        while (iter) {
          ancestorTitles.push(iter.name)
          iter = iter.suite
        }
        ancestorTitles.reverse()

        return {
          ancestorTitles,
          fullName: t.name
            ? [...ancestorTitles, t.name].join(' ')
            : ancestorTitles.join(' '),
          status: StatusMap[t.result?.state || t.mode] || 'skipped',
          title: t.name,
          duration: t.result?.duration,
          failureMessages:
            t.result?.errors?.map(e => e.stack || e.message) || [],
          location: t.location,
          meta: t.meta,
        } satisfies JsonAssertionResult
      })

      if (tests.some(t => t.result?.state === 'run' || t.result?.state === 'queued')) {
        this.ctx.logger.warn(
          'WARNING: Some tests are still running when generating the JSON report.'
          + 'This is likely an internal bug in Vitest.'
          + 'Please report it to https://github.com/vitest-dev/vitest/issues',
        )
      }

      const hasFailedTests = tests.some(t => t.result?.state === 'fail')

      testResults.push({
        assertionResults,
        startTime,
        endTime,
        status:
          file.result?.state === 'fail' || hasFailedTests ? 'failed' : 'passed',
        message: file.result?.errors?.[0]?.message ?? '',
        name: file.filepath,
      })
    }

    return {
      numTotalTestSuites,
      numPassedTestSuites,
      numFailedTestSuites,
      numPendingTestSuites,
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numPendingTests,
      numTodoTests,
      snapshot: this.ctx.snapshot.summary,
      startTime: this.start,
      success,
      testResults,
      coverageMap,
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), _errors: unknown[] = [], coverageMap?: unknown) {
    const results = await this.logTasks(files, coverageMap as CoverageMap)
    await this.writeReport(JSON.stringify(results))
  }

  /**
   * Writes the report to an output file if specified in the config,
   * or logs it to the console otherwise.
   * @param report
   */
  async writeReport(report: string) {
    const outputFile
      = this.options.outputFile ?? getOutputFile(this.ctx.config, 'json')

    if (outputFile) {
      const reportFile = resolve(this.ctx.config.root, outputFile)

      const outputDirectory = dirname(reportFile)
      if (!existsSync(outputDirectory)) {
        await fs.mkdir(outputDirectory, { recursive: true })
      }

      await fs.writeFile(reportFile, report, 'utf-8')
      this.ctx.logger.log(`JSON report written to ${reportFile}`)
    }
    else {
      this.ctx.logger.log(report)
    }
  }
}
