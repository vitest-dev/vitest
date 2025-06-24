import type { File, Task } from '@vitest/runner'
import type { TestError, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { Reporter } from '../types/reporter'
import type { TestCase, TestCollection, TestModule, TestModuleState, TestResult, TestSuite, TestSuiteState } from './reported-tasks'
import { performance } from 'node:perf_hooks'
import { getFullName, getSuites, getTestName, getTests, hasFailed } from '@vitest/runner/utils'
import { toArray } from '@vitest/utils'
import { parseStacktrace } from '@vitest/utils/source-map'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { isTTY } from '../../utils/env'
import { hasFailedSnapshot } from '../../utils/tasks'
import { F_CHECK, F_DOWN_RIGHT, F_POINTER, F_RIGHT } from './renderers/figures'
import { countTestErrors, divider, errorBanner, formatProjectName, formatTime, formatTimeString, getStateString, getStateSymbol, padSummaryTitle, renderSnapshotSummary, taskFail, withLabel } from './renderers/utils'

const BADGE_PADDING = '       '

export interface BaseOptions {
  isTTY?: boolean
}

export abstract class BaseReporter implements Reporter {
  start = 0
  end = 0
  watchFilters?: string[]
  failedUnwatchedFiles: TestModule[] = []
  isTTY: boolean
  ctx: Vitest = undefined!
  renderSucceed = false

  protected verbose = false

  private _filesInWatchMode = new Map<string, number>()
  private _timeStart = formatTimeString(new Date())

  constructor(options: BaseOptions = {}) {
    this.isTTY = options.isTTY ?? isTTY
  }

  onInit(ctx: Vitest): void {
    this.ctx = ctx

    this.ctx.logger.printBanner()
    this.start = performance.now()
  }

  log(...messages: any): void {
    this.ctx.logger.log(...messages)
  }

  error(...messages: any): void {
    this.ctx.logger.error(...messages)
  }

  relative(path: string): string {
    return relative(this.ctx.config.root, path)
  }

  onFinished(files: File[] = this.ctx.state.getFiles(), errors: unknown[] = this.ctx.state.getUnhandledErrors()): void {
    this.end = performance.now()
    if (!files.length && !errors.length) {
      this.ctx.logger.printNoTestFound(this.ctx.filenamePattern)
    }
    else {
      this.reportSummary(files, errors)
    }
  }

  onTestCaseResult(testCase: TestCase): void {
    if (testCase.result().state === 'failed') {
      this.logFailedTask(testCase.task)
    }
  }

  onTestSuiteResult(testSuite: TestSuite): void {
    if (testSuite.state() === 'failed') {
      this.logFailedTask(testSuite.task)
    }
  }

  onTestModuleEnd(testModule: TestModule): void {
    if (testModule.state() === 'failed') {
      this.logFailedTask(testModule.task)
    }

    this.printTestModule(testModule)
  }

  private logFailedTask(task: Task) {
    if (this.ctx.config.silent === 'passed-only') {
      for (const log of task.logs || []) {
        this.onUserConsoleLog(log, 'failed')
      }
    }
  }

  protected printTestModule(testModule: TestModule): void {
    const moduleState = testModule.state()
    if (moduleState === 'queued' || moduleState === 'pending') {
      return
    }

    let testsCount = 0
    let failedCount = 0
    let skippedCount = 0

    // delaying logs to calculate the test stats first
    // which minimizes the amount of for loops
    const logs: string[] = []
    const originalLog = this.log.bind(this)
    this.log = (msg: string) => logs.push(msg)

    const visit = (suiteState: TestSuiteState, children: TestCollection) => {
      for (const child of children) {
        if (child.type === 'suite') {
          const suiteState = child.state()

          // Skipped suites are hidden when --hideSkippedTests, print otherwise
          if (!this.ctx.config.hideSkippedTests || suiteState !== 'skipped') {
            this.printTestSuite(child)
          }

          visit(suiteState, child.children)
        }
        else {
          const testResult = child.result()

          testsCount++
          if (testResult.state === 'failed') {
            failedCount++
          }
          else if (testResult.state === 'skipped') {
            skippedCount++
          }

          if (this.ctx.config.hideSkippedTests && suiteState === 'skipped') {
            // Skipped suites are hidden when --hideSkippedTests
            continue
          }

          this.printTestCase(moduleState, child)
        }
      }
    }

    try {
      visit(moduleState, testModule.children)
    }
    finally {
      this.log = originalLog
    }

    this.log(this.getModuleLog(testModule, {
      tests: testsCount,
      failed: failedCount,
      skipped: skippedCount,
    }))
    logs.forEach(log => this.log(log))
  }

  protected printTestCase(moduleState: TestModuleState, test: TestCase): void {
    const testResult = test.result()

    const { duration, retryCount, repeatCount } = test.diagnostic() || {}
    const padding = this.getTestIndentation(test.task)
    let suffix = this.getDurationPrefix(test.task)

    if (retryCount != null && retryCount > 0) {
      suffix += c.yellow(` (retry x${retryCount})`)
    }

    if (repeatCount != null && repeatCount > 0) {
      suffix += c.yellow(` (repeat x${repeatCount})`)
    }

    if (testResult.state === 'failed') {
      this.log(c.red(` ${padding}${taskFail} ${this.getTestName(test.task, c.dim(' > '))}`) + suffix)

      // print short errors, full errors will be at the end in summary
      testResult.errors.forEach((error) => {
        const message = this.formatShortError(error)

        if (message) {
          this.log(c.red(`   ${padding}${message}`))
        }
      })
    }

    // also print slow tests
    else if (duration && duration > this.ctx.config.slowTestThreshold) {
      this.log(` ${padding}${c.yellow(c.dim(F_CHECK))} ${this.getTestName(test.task, c.dim(' > '))} ${suffix}`)
    }

    else if (this.ctx.config.hideSkippedTests && (testResult.state === 'skipped')) {
      // Skipped tests are hidden when --hideSkippedTests
    }

    // also print skipped tests that have notes
    else if (testResult.state === 'skipped' && testResult.note) {
      this.log(` ${padding}${getStateSymbol(test.task)} ${this.getTestName(test.task, c.dim(' > '))}${c.dim(c.gray(` [${testResult.note}]`))}`)
    }

    else if (this.renderSucceed || moduleState === 'failed') {
      this.log(` ${padding}${getStateSymbol(test.task)} ${this.getTestName(test.task, c.dim(' > '))}${suffix}`)
    }
  }

  private getModuleLog(testModule: TestModule, counts: {
    tests: number
    failed: number
    skipped: number
  }): string {
    let state = c.dim(`${counts.tests} test${counts.tests > 1 ? 's' : ''}`)

    if (counts.failed) {
      state += c.dim(' | ') + c.red(`${counts.failed} failed`)
    }

    if (counts.skipped) {
      state += c.dim(' | ') + c.yellow(`${counts.skipped} skipped`)
    }

    let suffix = c.dim('(') + state + c.dim(')') + this.getDurationPrefix(testModule.task)

    const diagnostic = testModule.diagnostic()
    if (diagnostic.heap != null) {
      suffix += c.magenta(` ${Math.floor(diagnostic.heap / 1024 / 1024)} MB heap used`)
    }

    let title = getStateSymbol(testModule.task)

    if (testModule.meta().typecheck) {
      title += ` ${c.bgBlue(c.bold(' TS '))}`
    }

    if (testModule.project.name) {
      title += ` ${formatProjectName(testModule.project, '')}`
    }

    return ` ${title} ${testModule.task.name} ${suffix}`
  }

  protected printTestSuite(_suite: TestSuite): void {
    // Suite name is included in getTestName by default
  }

  protected getTestName(test: Task, separator?: string): string {
    return getTestName(test, separator)
  }

  protected getFullName(test: Task, separator?: string): string {
    return getFullName(test, separator)
  }

  protected formatShortError(error: TestError): string {
    return `${F_RIGHT} ${error.message}`
  }

  protected getTestIndentation(_test: Task) {
    return '  '
  }

  protected printAnnotations(test: TestCase, console: 'log' | 'error', padding = 0): void {
    const annotations = test.annotations()
    if (!annotations.length) {
      return
    }

    const PADDING = ' '.repeat(padding)

    annotations.forEach(({ location, type, message }) => {
      if (location) {
        const file = relative(test.project.config.root, location.file)
        this[console](`${PADDING}${c.blue(F_POINTER)} ${c.gray(`${file}:${location.line}:${location.column}`)} ${c.bold(type)}`)
      }
      else {
        this[console](`${PADDING}${c.blue(F_POINTER)} ${c.bold(type)}`)
      }
      this[console](`${PADDING}  ${c.blue(F_DOWN_RIGHT)} ${message}`)
    })
  }

  protected getDurationPrefix(task: Task): string {
    if (!task.result?.duration) {
      return ''
    }

    const color = task.result.duration > this.ctx.config.slowTestThreshold
      ? c.yellow
      : c.green

    return color(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
  }

  onWatcherStart(files: File[] = this.ctx.state.getFiles(), errors: unknown[] = this.ctx.state.getUnhandledErrors()): void {
    const failed = errors.length > 0 || hasFailed(files)

    if (failed) {
      this.log(withLabel('red', 'FAIL', 'Tests failed. Watching for file changes...'))
    }
    else if (this.ctx.isCancelling) {
      this.log(withLabel('red', 'CANCELLED', 'Test run cancelled. Watching for file changes...'))
    }
    else {
      this.log(withLabel('green', 'PASS', 'Waiting for file changes...'))
    }

    const hints = [c.dim('press ') + c.bold('h') + c.dim(' to show help')]

    if (hasFailedSnapshot(files)) {
      hints.unshift(c.dim('press ') + c.bold(c.yellow('u')) + c.dim(' to update snapshot'))
    }
    else {
      hints.push(c.dim('press ') + c.bold('q') + c.dim(' to quit'))
    }

    this.log(BADGE_PADDING + hints.join(c.dim(', ')))
  }

  onWatcherRerun(files: string[], trigger?: string): void {
    this.watchFilters = files
    this.failedUnwatchedFiles = this.ctx.state.getTestModules().filter(testModule =>
      !files.includes(testModule.task.filepath) && testModule.state() === 'failed',
    )

    // Update re-run count for each file
    files.forEach((filepath) => {
      let reruns = this._filesInWatchMode.get(filepath) ?? 0
      this._filesInWatchMode.set(filepath, ++reruns)
    })

    let banner = trigger ? c.dim(`${this.relative(trigger)} `) : ''

    if (files.length === 1) {
      const rerun = this._filesInWatchMode.get(files[0]) ?? 1
      banner += c.blue(`x${rerun} `)
    }

    this.ctx.logger.clearFullScreen()
    this.log(withLabel('blue', 'RERUN', banner))

    if (this.ctx.configOverride.project) {
      this.log(BADGE_PADDING + c.dim(' Project name: ') + c.blue(toArray(this.ctx.configOverride.project).join(', ')))
    }

    if (this.ctx.filenamePattern) {
      this.log(BADGE_PADDING + c.dim(' Filename pattern: ') + c.blue(this.ctx.filenamePattern.join(', ')))
    }

    if (this.ctx.configOverride.testNamePattern) {
      this.log(BADGE_PADDING + c.dim(' Test name pattern: ') + c.blue(String(this.ctx.configOverride.testNamePattern)))
    }

    this.log('')

    for (const testModule of this.failedUnwatchedFiles) {
      this.printTestModule(testModule)
    }

    this._timeStart = formatTimeString(new Date())
    this.start = performance.now()
  }

  onUserConsoleLog(log: UserConsoleLog, taskState?: TestResult['state']): void {
    if (!this.shouldLog(log, taskState)) {
      return
    }

    const output
      = log.type === 'stdout'
        ? this.ctx.logger.outputStream
        : this.ctx.logger.errorStream

    const write = (msg: string) => (output as any).write(msg)

    let headerText = 'unknown test'
    const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined

    if (task) {
      headerText = this.getFullName(task, c.dim(' > '))
    }
    else if (log.taskId && log.taskId !== '__vitest__unknown_test__') {
      headerText = log.taskId
    }

    write(c.gray(log.type + c.dim(` | ${headerText}\n`)) + log.content)

    if (log.origin) {
      // browser logs don't have an extra end of line at the end like Node.js does
      if (log.browser) {
        write('\n')
      }

      const project = task
        ? this.ctx.getProjectByName(task.file.projectName || '')
        : this.ctx.getRootProject()

      const stack = log.browser
        ? (project.browser?.parseStacktrace(log.origin) || [])
        : parseStacktrace(log.origin)

      const highlight = task && stack.find(i => i.file === task.file.filepath)

      for (const frame of stack) {
        const color = frame === highlight ? c.cyan : c.gray
        const path = relative(project.config.root, frame.file)

        const positions = [
          frame.method,
          `${path}:${c.dim(`${frame.line}:${frame.column}`)}`,
        ]
          .filter(Boolean)
          .join(' ')

        write(color(` ${c.dim(F_POINTER)} ${positions}\n`))
      }
    }

    write('\n')
  }

  onTestRemoved(trigger?: string): void {
    this.log(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''))
  }

  shouldLog(log: UserConsoleLog, taskState?: TestResult['state']): boolean {
    if (this.ctx.config.silent === true) {
      return false
    }

    if (this.ctx.config.silent === 'passed-only' && taskState !== 'failed') {
      return false
    }

    if (this.ctx.config.onConsoleLog) {
      const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined
      const entity = task && this.ctx.state.getReportedEntity(task)
      const shouldLog = this.ctx.config.onConsoleLog(log.content, log.type, entity)
      if (shouldLog === false) {
        return shouldLog
      }
    }
    return true
  }

  onServerRestart(reason?: string): void {
    this.log(c.bold(c.magenta(
      reason === 'config'
        ? '\nRestarting due to config changes...'
        : '\nRestarting Vitest...',
    )))
  }

  reportSummary(files: File[], errors: unknown[]): void {
    this.printErrorsSummary(files, errors)

    if (this.ctx.config.mode === 'benchmark') {
      this.reportBenchmarkSummary(files)
    }
    else {
      this.reportTestSummary(files, errors)
    }
  }

  reportTestSummary(files: File[], errors: unknown[]): void {
    this.log()

    const affectedFiles = [
      ...this.failedUnwatchedFiles.map(m => m.task),
      ...files,
    ]
    const tests = getTests(affectedFiles)

    const snapshotOutput = renderSnapshotSummary(
      this.ctx.config.root,
      this.ctx.snapshot.summary,
    )

    for (const [index, snapshot] of snapshotOutput.entries()) {
      const title = index === 0 ? 'Snapshots' : ''
      this.log(`${padSummaryTitle(title)} ${snapshot}`)
    }

    if (snapshotOutput.length > 1) {
      this.log()
    }

    this.log(padSummaryTitle('Test Files'), getStateString(affectedFiles))
    this.log(padSummaryTitle('Tests'), getStateString(tests))

    if (this.ctx.projects.some(c => c.config.typecheck.enabled)) {
      const failed = tests.filter(t => t.meta?.typecheck && t.result?.errors?.length)

      this.log(
        padSummaryTitle('Type Errors'),
        failed.length
          ? c.bold(c.red(`${failed.length} failed`))
          : c.dim('no errors'),
      )
    }

    if (errors.length) {
      this.log(
        padSummaryTitle('Errors'),
        c.bold(c.red(`${errors.length} error${errors.length > 1 ? 's' : ''}`)),
      )
    }

    this.log(padSummaryTitle('Start at'), this._timeStart)

    const collectTime = sum(files, file => file.collectDuration)
    const testsTime = sum(files, file => file.result?.duration)
    const setupTime = sum(files, file => file.setupDuration)

    if (this.watchFilters) {
      this.log(padSummaryTitle('Duration'), formatTime(collectTime + testsTime + setupTime))
    }
    else {
      const blobs = this.ctx.state.blobs

      // Execution time is either sum of all runs of `--merge-reports` or the current run's time
      const executionTime = blobs?.executionTimes ? sum(blobs.executionTimes, time => time) : this.end - this.start

      const environmentTime = sum(files, file => file.environmentLoad)
      const prepareTime = sum(files, file => file.prepareDuration)
      const transformTime = sum(this.ctx.projects, project => project.vitenode.getTotalDuration())
      const typecheck = sum(this.ctx.projects, project => project.typechecker?.getResult().time)

      const timers = [
        `transform ${formatTime(transformTime)}`,
        `setup ${formatTime(setupTime)}`,
        `collect ${formatTime(collectTime)}`,
        `tests ${formatTime(testsTime)}`,
        `environment ${formatTime(environmentTime)}`,
        `prepare ${formatTime(prepareTime)}`,
        typecheck && `typecheck ${formatTime(typecheck)}`,
      ].filter(Boolean).join(', ')

      this.log(padSummaryTitle('Duration'), formatTime(executionTime) + c.dim(` (${timers})`))

      if (blobs?.executionTimes) {
        this.log(padSummaryTitle('Per blob') + blobs.executionTimes.map(time => ` ${formatTime(time)}`).join(''))
      }
    }

    this.log()
  }

  private printErrorsSummary(files: File[], errors: unknown[]) {
    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.errors)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = countTestErrors(failedSuites) + countTestErrors(failedTests)

    let current = 1
    const errorDivider = () => this.error(`${c.red(c.dim(divider(`[${current++}/${failedTotal}]`, undefined, 1)))}\n`)

    if (failedSuites.length) {
      this.error(`\n${errorBanner(`Failed Suites ${failedSuites.length}`)}\n`)
      this.printTaskErrors(failedSuites, errorDivider)
    }

    if (failedTests.length) {
      this.error(`\n${errorBanner(`Failed Tests ${failedTests.length}`)}\n`)
      this.printTaskErrors(failedTests, errorDivider)
    }

    if (errors.length) {
      this.ctx.logger.printUnhandledErrors(errors)
      this.error()
    }
  }

  reportBenchmarkSummary(files: File[]): void {
    const benches = getTests(files)
    const topBenches = benches.filter(i => i.result?.benchmark?.rank === 1)

    this.log(`\n${withLabel('cyan', 'BENCH', 'Summary\n')}`)

    for (const bench of topBenches) {
      const group = bench.suite || bench.file

      if (!group) {
        continue
      }

      const groupName = this.getFullName(group, c.dim(' > '))
      const project = this.ctx.projects.find(p => p.name === bench.file.projectName)

      this.log(`  ${formatProjectName(project)}${bench.name}${c.dim(` - ${groupName}`)}`)

      const siblings = group.tasks
        .filter(i => i.meta.benchmark && i.result?.benchmark && i !== bench)
        .sort((a, b) => a.result!.benchmark!.rank - b.result!.benchmark!.rank)

      for (const sibling of siblings) {
        const number = (sibling.result!.benchmark!.mean / bench.result!.benchmark!.mean).toFixed(2)
        this.log(c.green(`    ${number}x `) + c.gray('faster than ') + sibling.name)
      }

      this.log('')
    }
  }

  private printTaskErrors(tasks: Task[], errorDivider: () => void) {
    const errorsQueue: [error: TestError | undefined, tests: Task[]][] = []

    for (const task of tasks) {
      // Merge identical errors
      task.result?.errors?.forEach((error) => {
        let previous

        if (error?.stack) {
          previous = errorsQueue.find((i) => {
            if (i[0]?.stack !== error.stack) {
              return false
            }

            const currentProjectName = (task as File)?.projectName || task.file?.projectName || ''
            const projectName = (i[1][0] as File)?.projectName || i[1][0].file?.projectName || ''

            const currentAnnotations = task.type === 'test' && task.annotations
            const itemAnnotations = i[1][0].type === 'test' && i[1][0].annotations

            return projectName === currentProjectName && deepEqual(currentAnnotations, itemAnnotations)
          })
        }

        if (previous) {
          previous[1].push(task)
        }
        else {
          errorsQueue.push([error, [task]])
        }
      })
    }

    for (const [error, tasks] of errorsQueue) {
      for (const task of tasks) {
        const filepath = (task as File)?.filepath || ''
        const projectName = (task as File)?.projectName || task.file?.projectName || ''
        const project = this.ctx.projects.find(p => p.name === projectName)

        let name = this.getFullName(task, c.dim(' > '))

        if (filepath) {
          name += c.dim(` [ ${this.relative(filepath)} ]`)
        }

        this.ctx.logger.error(
          `${c.bgRed(c.bold(' FAIL '))} ${formatProjectName(project)}${name}`,
        )
      }

      const screenshotPaths = tasks.map(t => t.meta?.failScreenshotPath).filter(screenshot => screenshot != null)

      this.ctx.logger.printError(error, {
        project: this.ctx.getProjectByName(tasks[0].file.projectName || ''),
        verbose: this.verbose,
        screenshotPaths,
        task: tasks[0],
      })

      if (tasks[0].type === 'test' && tasks[0].annotations.length) {
        const test = this.ctx.state.getReportedEntity(tasks[0]) as TestCase
        this.printAnnotations(test, 'error', 1)
        this.error()
      }

      errorDivider()
    }
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false
    }
  }
  return true
}

function sum<T>(items: T[], cb: (_next: T) => number | undefined) {
  return items.reduce((total, next) => {
    return total + Math.max(cb(next) || 0, 0)
  }, 0)
}
