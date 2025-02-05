import type { Vitest } from '../core'
import type { TestSpecification } from '../spec'
import type { Reporter } from '../types/reporter'
import type { ReportedHookContext, TestCase, TestModule } from './reported-tasks'
import c from 'tinyrainbow'
import { F_POINTER, F_TREE_NODE_END, F_TREE_NODE_MIDDLE } from './renderers/figures'
import { formatProjectName, formatTime, formatTimeString, padSummaryTitle } from './renderers/utils'
import { WindowRenderer } from './renderers/windowedRenderer'

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

interface RunningModule extends Pick<Counter, 'total' | 'completed'> {
  filename: TestModule['task']['name']
  projectName: TestModule['project']['name']
  hook?: Omit<SlowTask, 'hook'>
  tests: Map<TestCase['id'], SlowTask>
  typecheck: boolean
}

/**
 * Reporter extension that renders summary and forwards all other logs above itself.
 * Intended to be used by other reporters, not as a standalone reporter.
 */
export class SummaryReporter implements Reporter {
  private ctx!: Vitest
  private options!: Options
  private renderer!: WindowRenderer

  private modules = emptyCounters()
  private tests = emptyCounters()
  private maxParallelTests = 0

  /** Currently running test modules, may include finished test modules too */
  private runningModules = new Map<TestModule['id'], RunningModule>()

  /** ID of finished `this.runningModules` that are currently being shown */
  private finishedModules = new Map<TestModule['id'], NodeJS.Timeout>()

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

    this.ctx.onClose(() => {
      clearInterval(this.durationInterval)
      this.renderer.stop()
    })
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>) {
    this.runningModules.clear()
    this.finishedModules.clear()
    this.modules = emptyCounters()
    this.tests = emptyCounters()

    this.startTimers()
    this.renderer.start()

    this.modules.total = specifications.length
  }

  onTestRunEnd() {
    this.runningModules.clear()
    this.finishedModules.clear()
    this.renderer.finish()
    clearInterval(this.durationInterval)
  }

  onTestModuleQueued(module: TestModule) {
    // When new test module starts, take the place of previously finished test module, if any
    if (this.finishedModules.size) {
      const finished = this.finishedModules.keys().next().value
      this.removeTestModule(finished)
    }

    this.runningModules.set(module.id, initializeStats(module))
    this.renderer.schedule()
  }

  onTestModuleCollected(module: TestModule) {
    let stats = this.runningModules.get(module.id)

    if (!stats) {
      stats = initializeStats(module)
      this.runningModules.set(module.id, stats)
    }

    const total = Array.from(module.children.allTests()).length
    this.tests.total += total
    stats.total = total

    this.maxParallelTests = Math.max(this.maxParallelTests, this.runningModules.size)
    this.renderer.schedule()
  }

  onHookStart(options: ReportedHookContext) {
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

  onHookEnd(options: ReportedHookContext) {
    const stats = this.getHookStats(options)

    if (stats?.hook?.name !== options.name) {
      return
    }

    stats.hook.onFinish()
    stats.hook.visible = false
  }

  onTestCaseReady(test: TestCase) {
    // Track slow running tests only on verbose mode
    if (!this.options.verbose) {
      return
    }

    const stats = this.runningModules.get(test.module.id)

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

  onTestCaseResult(test: TestCase) {
    const stats = this.runningModules.get(test.module.id)

    if (!stats) {
      return
    }

    stats.tests.get(test.id)?.onFinish()
    stats.tests.delete(test.id)

    stats.completed++
    const result = test.result()

    if (result?.state === 'passed') {
      this.tests.passed++
    }
    else if (result?.state === 'failed') {
      this.tests.failed++
    }
    else if (!result?.state || result?.state === 'skipped') {
      this.tests.skipped++
    }

    this.renderer.schedule()
  }

  onTestModuleEnd(module: TestModule) {
    const state = module.state()
    this.modules.completed++

    if (state === 'passed') {
      this.modules.passed++
    }
    else if (state === 'failed') {
      this.modules.failed++
    }
    else if (module.task.mode === 'todo' && state === 'skipped') {
      this.modules.todo++
    }
    else if (state === 'skipped') {
      this.modules.skipped++
    }

    const left = this.modules.total - this.modules.completed

    // Keep finished tests visible in summary for a while if there are more tests left.
    // When a new test starts in onTestModuleQueued it will take this ones place.
    // This reduces flickering by making summary more stable.
    if (left > this.maxParallelTests) {
      this.finishedModules.set(module.id, setTimeout(() => {
        this.removeTestModule(module.id)
      }, FINISHED_TEST_CLEANUP_TIME_MS).unref())
    }
    else {
      // Run is about to end as there are less tests left than whole run had parallel at max.
      // Remove finished test immediatelly.
      this.removeTestModule(module.id)
    }

    this.renderer.schedule()
  }

  private getHookStats({ entity }: ReportedHookContext) {
    // Track slow running hooks only on verbose mode
    if (!this.options.verbose) {
      return
    }

    const module = entity.type === 'module' ? entity : entity.module
    const stats = this.runningModules.get(module.id)

    if (!stats) {
      return
    }

    return entity.type === 'test' ? stats.tests.get(entity.id) : stats
  }

  private createSummary() {
    const summary = ['']

    for (const testFile of Array.from(this.runningModules.values()).sort(sortRunningModules)) {
      const typecheck = testFile.typecheck ? `${c.bgBlue(c.bold(' TS '))} ` : ''
      summary.push(
        c.bold(c.yellow(` ${F_POINTER} `))
        + formatProjectName(testFile.projectName)
        + typecheck
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

    if (this.runningModules.size > 0) {
      summary.push('')
    }

    summary.push(padSummaryTitle('Test Files') + getStateString(this.modules))
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

  private removeTestModule(id?: TestModule['id']) {
    if (!id) {
      return
    }

    const testFile = this.runningModules.get(id)
    testFile?.hook?.onFinish()
    testFile?.tests?.forEach(test => test.onFinish())

    this.runningModules.delete(id)

    clearTimeout(this.finishedModules.get(id))
    this.finishedModules.delete(id)
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

function sortRunningModules(a: RunningModule, b: RunningModule) {
  if ((a.projectName || '') > (b.projectName || '')) {
    return 1
  }

  if ((a.projectName || '') < (b.projectName || '')) {
    return -1
  }

  return a.filename.localeCompare(b.filename)
}

function initializeStats(module: TestModule): RunningModule {
  return {
    total: 0,
    completed: 0,
    filename: module.task.name,
    projectName: module.project.name,
    tests: new Map(),
    typecheck: !!module.task.meta.typecheck,
  }
}
