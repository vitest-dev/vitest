import type { Custom, File, TaskResultPack, Test } from '@vitest/runner'
import type { Vitest } from '../core'
import type { Reporter } from '../types/reporter'
import { getTests } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { F_POINTER } from './renderers/figures'
import { formatProjectName, formatTime, formatTimeString, padSummaryTitle } from './renderers/utils'
import { WindowRenderer } from './renderers/windowedRenderer'

const DURATION_UPDATE_INTERVAL_MS = 500
const FINISHED_TEST_CLEANUP_TIME_MS = 1_000

interface Counter {
  total: number
  completed: number
  passed: number
  failed: number
  skipped: number
  todo: number
}

interface RunningTest extends Pick<Counter, 'total' | 'completed'> {
  filename: File['name']
  projectName: File['projectName']
}

/**
 * Reporter extension that renders summary and forwards all other logs above itself.
 * Intended to be used by other reporters, not as a standalone reporter.
 */
export class SummaryReporter implements Reporter {
  private ctx!: Vitest
  private renderer!: WindowRenderer

  private suites = emptyCounters()
  private tests = emptyCounters()
  private maxParallelTests = 0

  /** Currently running tests, may include finished tests too */
  private runningTests = new Map<File['id'], RunningTest>()

  /** ID of finished `this.runningTests` that are currently being shown */
  private finishedTests = new Map<File['id'], NodeJS.Timeout>()

  /** IDs of all finished tests */
  private allFinishedTests = new Set<File['id']>()

  private startTime = ''
  private duration = 0
  private durationInterval: NodeJS.Timeout | undefined = undefined

  onInit(ctx: Vitest) {
    this.ctx = ctx

    this.renderer = new WindowRenderer({
      logger: ctx.logger,
      getWindow: () => this.createSummary(),
    })

    this.startTimers()

    this.ctx.onClose(() => {
      clearInterval(this.durationInterval)
      this.renderer.stop()
    })
  }

  onPathsCollected(paths?: string[]) {
    this.suites.total = (paths || []).length
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])

      if (task && 'filepath' in task && task.result?.state && task?.type === 'suite') {
        if (task?.result?.state === 'run') {
          this.onTestFilePrepare(task)
        }
        else {
          // Skipped tests are not reported, do it manually
          for (const test of getTests(task)) {
            if (!test.result || test.result?.state === 'skip') {
              this.onTestFinished(test)
            }
          }
        }
      }

      if (task?.type === 'test' || task?.type === 'custom') {
        if (task.result?.state !== 'run') {
          this.onTestFinished(task)
        }
      }
    }
  }

  onWatcherRerun() {
    this.runningTests.clear()
    this.finishedTests.clear()
    this.allFinishedTests.clear()
    this.suites = emptyCounters()
    this.tests = emptyCounters()

    this.startTimers()
    this.renderer.start()
  }

  onFinished() {
    this.runningTests.clear()
    this.finishedTests.clear()
    this.allFinishedTests.clear()
    this.renderer.finish()
    clearInterval(this.durationInterval)
  }

  private onTestFilePrepare(file: File) {
    if (this.allFinishedTests.has(file.id) || this.runningTests.has(file.id)) {
      return
    }

    const total = getTests(file).length
    this.tests.total += total

    // When new test starts, take the place of previously finished test, if any
    if (this.finishedTests.size) {
      const finished = this.finishedTests.entries().next().value

      if (finished) {
        clearTimeout(finished[1])
        this.finishedTests.delete(finished[0])
        this.runningTests.delete(finished[0])
      }
    }

    this.runningTests.set(file.id, {
      total,
      completed: 0,
      filename: file.name,
      projectName: file.projectName,
    })

    this.maxParallelTests = Math.max(this.maxParallelTests, this.runningTests.size)
  }

  private onTestFinished(test: Test | Custom) {
    const file = test.file
    let stats = this.runningTests.get(file.id)

    if (!stats) {
      // It's possible that that test finished before it's preparation was even reported
      this.onTestFilePrepare(test.file)
      stats = this.runningTests.get(file.id)!

      // It's also possible that this update came after whole test file was reported as finished
      if (!stats) {
        return
      }
    }

    stats.completed++
    const result = test.result

    if (result?.state === 'pass') {
      this.tests.passed++
    }
    else if (result?.state === 'fail') {
      this.tests.failed++
    }
    else if (!result?.state || result?.state === 'skip' || result?.state === 'todo') {
      this.tests.skipped++
    }

    if (stats.completed >= stats.total) {
      this.onTestFileFinished(file)
    }
  }

  private onTestFileFinished(file: File) {
    if (this.allFinishedTests.has(file.id)) {
      return
    }

    this.allFinishedTests.add(file.id)
    this.suites.completed++

    if (file.result?.state === 'pass') {
      this.suites.passed++
    }
    else if (file.result?.state === 'fail') {
      this.suites.failed++
    }
    else if (file.result?.state === 'skip') {
      this.suites.skipped++
    }
    else if (file.result?.state === 'todo') {
      this.suites.todo++
    }

    const left = this.suites.total - this.suites.completed

    // Keep finished tests visibe in summary for a while if there are more tests left.
    // When a new test starts in onTestFilePrepare it will take this ones place.
    // This reduces flickering by making summary more stable.
    if (left > this.maxParallelTests) {
      this.finishedTests.set(file.id, setTimeout(() => {
        this.finishedTests.delete(file.id)
        this.runningTests.delete(file.id)
      }, FINISHED_TEST_CLEANUP_TIME_MS).unref())
    }
    else {
      // Run is about to end as there are less tests left than whole run had parallel at max.
      // Remove finished test immediatelly.
      this.runningTests.delete(file.id)
    }
  }

  private createSummary() {
    const summary = ['']

    for (const test of Array.from(this.runningTests.values()).sort(sortRunningTests)) {
      summary.push(
        c.bold(c.yellow(` ${F_POINTER} `))
        + formatProjectName(test.projectName)
        + test.filename
        + c.dim(` ${test.completed}/${test.total}`),
      )
    }

    if (this.runningTests.size > 0) {
      summary.push('')
    }

    summary.push(padSummaryTitle('Test Files') + getStateString(this.suites))
    summary.push(padSummaryTitle('Tests') + getStateString(this.tests))
    summary.push(padSummaryTitle('Start at') + this.startTime)
    summary.push(padSummaryTitle('Duration') + formatTime(this.duration))

    summary.push('')

    return summary
  }

  private startTimers() {
    const start = performance.now()
    this.startTime = formatTimeString(new Date())

    this.durationInterval = setInterval(() => {
      this.duration = performance.now() - start
    }, DURATION_UPDATE_INTERVAL_MS)
  }
}

function emptyCounters(): Counter {
  return { completed: 0, passed: 0, failed: 0, skipped: 0, todo: 0, total: 0 }
}

function getStateString(entry: Counter) {
  return (
    [
      entry.failed ? c.bold(c.red(`${entry.failed} failed`)) : null,
      c.bold(c.green(`${entry.passed} passed`)),
      entry.skipped ? c.yellow(`${entry.skipped} skipped`) : null,
      entry.todo ? c.gray(`${entry.todo} todo`) : null,
    ]
      .filter(Boolean)
      .join(c.dim(' | ')) + c.gray(` (${entry.total})`)
  )
}

function sortRunningTests(a: RunningTest, b: RunningTest) {
  if ((a.projectName || '') > (b.projectName || '')) {
    return 1
  }

  if ((a.projectName || '') < (b.projectName || '')) {
    return -1
  }

  return a.filename.localeCompare(b.filename)
}
