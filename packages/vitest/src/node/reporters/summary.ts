import type { File, Test } from '@vitest/runner'
import type { Vitest } from '../core'
import type { Reporter } from '../types/reporter'
import type { TestModule } from './reported-tasks'
import type { HookOptions } from './task-parser'
import { getTests } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { F_POINTER, F_TREE_NODE_END, F_TREE_NODE_MIDDLE } from './renderers/figures'
import { formatProjectName, formatTime, formatTimeString, padSummaryTitle } from './renderers/utils'
import { WindowRenderer } from './renderers/windowedRenderer'
import { TaskParser } from './task-parser'

const DURATION_UPDATE_INTERVAL_MS = 100
const FINISHED_TEST_CLEANUP_TIME_MS = 1_000

interface Options {
  verbose?: boolean
}

interface Counter {
  total: number
  completed: number
  passed: number
  failed: number
  skipped: number
  todo: number
}

interface SlowTask {
  name: string
  visible: boolean
  startTime: number
  onFinish: () => void
  hook?: Omit<SlowTask, 'hook'>
}

interface RunningTest extends Pick<Counter, 'total' | 'completed'> {
  filename: File['name']
  projectName: File['projectName']
  hook?: Omit<SlowTask, 'hook'>
  tests: Map<Test['id'], SlowTask>
}

/**
 * Reporter extension that renders summary and forwards all other logs above itself.
 * Intended to be used by other reporters, not as a standalone reporter.
 */
export class SummaryReporter extends TaskParser implements Reporter {
  private options!: Options
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
  private currentTime = 0
  private duration = 0
  private durationInterval: NodeJS.Timeout | undefined = undefined

  onInit(ctx: Vitest, options: Options = {}) {
    this.ctx = ctx

    this.options = {
      verbose: false,
      ...options,
    }

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

  onTestModuleQueued(module: TestModule) {
    this.onTestFilePrepare(module.task)
  }

  onPathsCollected(paths?: string[]) {
    this.suites.total = (paths || []).length
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

  onTestFilePrepare(file: File) {
    if (this.runningTests.has(file.id)) {
      const stats = this.runningTests.get(file.id)!
      // if there are no tests, it means the test was queued but not collected
      if (!stats.total) {
        const total = getTests(file).length
        this.tests.total += total
        stats.total = total
      }
      return
    }

    if (this.allFinishedTests.has(file.id)) {
      return
    }

    const total = getTests(file).length
    this.tests.total += total

    // When new test starts, take the place of previously finished test, if any
    if (this.finishedTests.size) {
      const finished = this.finishedTests.keys().next().value
      this.removeTestFile(finished)
    }

    this.runningTests.set(file.id, {
      total,
      completed: 0,
      filename: file.name,
      projectName: file.projectName,
      tests: new Map(),
    })

    this.maxParallelTests = Math.max(this.maxParallelTests, this.runningTests.size)
  }

  onHookStart(options: HookOptions) {
    const stats = this.getHookStats(options)

    if (!stats) {
      return
    }

    const hook = {
      name: options.name,
      visible: false,
      startTime: performance.now(),
      onFinish: () => {},
    }
    stats.hook?.onFinish?.()
    stats.hook = hook

    const timeout = setTimeout(() => {
      hook.visible = true
    }, this.ctx.config.slowTestThreshold).unref()

    hook.onFinish = () => clearTimeout(timeout)
  }

  onHookEnd(options: HookOptions) {
    const stats = this.getHookStats(options)

    if (stats?.hook?.name !== options.name) {
      return
    }

    stats.hook.onFinish()
    stats.hook.visible = false
  }

  onTestStart(test: Test) {
    // Track slow running tests only on verbose mode
    if (!this.options.verbose) {
      return
    }

    const stats = this.getTestStats(test)

    if (!stats || stats.tests.has(test.id)) {
      return
    }

    const slowTest: SlowTask = {
      name: test.name,
      visible: false,
      startTime: performance.now(),
      onFinish: () => {},
    }

    const timeout = setTimeout(() => {
      slowTest.visible = true
    }, this.ctx.config.slowTestThreshold).unref()

    slowTest.onFinish = () => {
      slowTest.hook?.onFinish()
      clearTimeout(timeout)
    }

    stats.tests.set(test.id, slowTest)
  }

  onTestFinished(test: Test) {
    const stats = this.getTestStats(test)

    if (!stats) {
      return
    }

    stats.tests.get(test.id)?.onFinish()
    stats.tests.delete(test.id)

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
  }

  onTestFileFinished(file: File) {
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
        this.removeTestFile(file.id)
      }, FINISHED_TEST_CLEANUP_TIME_MS).unref())
    }
    else {
      // Run is about to end as there are less tests left than whole run had parallel at max.
      // Remove finished test immediatelly.
      this.removeTestFile(file.id)
    }
  }

  private getTestStats(test: Test) {
    const file = test.file
    let stats = this.runningTests.get(file.id)

    if (!stats || stats.total === 0) {
      // It's possible that that test finished before it's preparation was even reported
      this.onTestFilePrepare(test.file)
      stats = this.runningTests.get(file.id)!

      // It's also possible that this update came after whole test file was reported as finished
      if (!stats) {
        return
      }
    }

    return stats
  }

  private getHookStats({ file, id, type }: HookOptions) {
    // Track slow running hooks only on verbose mode
    if (!this.options.verbose) {
      return
    }

    const stats = this.runningTests.get(file.id)

    if (!stats) {
      return
    }

    return type === 'suite' ? stats : stats?.tests.get(id)
  }

  private createSummary() {
    const summary = ['']

    for (const testFile of Array.from(this.runningTests.values()).sort(sortRunningTests)) {
      summary.push(
        c.bold(c.yellow(` ${F_POINTER} `))
        + formatProjectName(testFile.projectName)
        + testFile.filename
        + c.dim(!testFile.completed && !testFile.total
          ? ' [queued]'
          : ` ${testFile.completed}/${testFile.total}`),
      )

      const slowTasks = [
        testFile.hook,
        ...Array.from(testFile.tests.values()),
      ].filter((t): t is SlowTask => t != null && t.visible)

      for (const [index, task] of slowTasks.entries()) {
        const elapsed = this.currentTime - task.startTime
        const icon = index === slowTasks.length - 1 ? F_TREE_NODE_END : F_TREE_NODE_MIDDLE

        summary.push(
          c.bold(c.yellow(`   ${icon} `))
          + task.name
          + c.bold(c.yellow(` ${formatTime(Math.max(0, elapsed))}`)),
        )

        if (task.hook?.visible) {
          summary.push(c.bold(c.yellow(`      ${F_TREE_NODE_END} `)) + task.hook.name)
        }
      }
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
      this.currentTime = performance.now()
      this.duration = this.currentTime - start
    }, DURATION_UPDATE_INTERVAL_MS).unref()
  }

  private removeTestFile(id?: File['id']) {
    if (!id) {
      return
    }

    const testFile = this.runningTests.get(id)
    testFile?.hook?.onFinish()
    testFile?.tests?.forEach(test => test.onFinish())

    this.runningTests.delete(id)

    clearTimeout(this.finishedTests.get(id))
    this.finishedTests.delete(id)
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
