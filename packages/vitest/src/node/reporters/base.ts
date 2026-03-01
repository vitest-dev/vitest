import type { File, Task, TestAnnotation } from '@vitest/runner'
import type { ParsedStack, SerializedError } from '@vitest/utils'
import type { AsyncLeak, TestError, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'
import type { Reporter, TestRunEndReason } from '../types/reporter'
import type { TestCase, TestCollection, TestModule, TestModuleState, TestResult, TestSuite, TestSuiteState } from './reported-tasks'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { getSuites, getTestName, getTests, hasFailed } from '@vitest/runner/utils'
import { toArray } from '@vitest/utils/helpers'
import { parseStacktrace } from '@vitest/utils/source-map'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { groupBy } from '../../utils/base'
import { isTTY } from '../../utils/env'
import { hasFailedSnapshot } from '../../utils/tasks'
import { generateCodeFrame, printStack } from '../printError'
import { F_CHECK, F_DOWN_RIGHT, F_POINTER } from './renderers/figures'
import {
  countTestErrors,
  divider,
  errorBanner,
  formatProjectName,
  formatTime,
  formatTimeString,
  getStateString,
  getStateSymbol,
  padSummaryTitle,
  renderSnapshotSummary,
  separator,
  taskFail,
  withLabel,
} from './renderers/utils'

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

  onTestRunStart(_specifications: ReadonlyArray<TestSpecification>): void {
    this.start = performance.now()
    this._timeStart = formatTimeString(new Date())
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    _reason: TestRunEndReason,
  ): void {
    const files = testModules.map(testModule => testModule.task)
    const errors = [...unhandledErrors]

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

    const { duration = 0 } = test.diagnostic() || {}
    const padding = this.getTestIndentation(test.task)
    const suffix = this.getTestCaseSuffix(test)

    if (testResult.state === 'failed') {
      this.log(c.red(` ${padding}${taskFail} ${this.getTestName(test.task, separator)}`) + suffix)
    }

    // also print slow tests
    else if (duration > this.ctx.config.slowTestThreshold) {
      this.log(` ${padding}${c.yellow(c.dim(F_CHECK))} ${this.getTestName(test.task, separator)} ${suffix}`)
    }

    else if (this.ctx.config.hideSkippedTests && (testResult.state === 'skipped')) {
      // Skipped tests are hidden when --hideSkippedTests
    }

    else if (this.renderSucceed || moduleState === 'failed') {
      this.log(` ${padding}${this.getStateSymbol(test)} ${this.getTestName(test.task, separator)}${suffix}`)
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

    const title = this.getEntityPrefix(testModule)

    return ` ${title} ${testModule.task.name} ${suffix}`
  }

  protected printTestSuite(testSuite: TestSuite): void {
    if (!this.renderSucceed) {
      return
    }

    const indentation = '  '.repeat(getIndentation(testSuite.task))
    const tests = Array.from(testSuite.children.allTests())
    const state = this.getStateSymbol(testSuite)

    this.log(` ${indentation}${state} ${testSuite.name} ${c.dim(`(${tests.length})`)}`)
  }

  protected getTestName(test: Task, _separator?: string): string {
    return test.name
  }

  protected getFullName(test: Task, separator?: string): string {
    if (test === test.file) {
      return test.name
    }

    let name = test.file.name
    if (test.location) {
      name += c.dim(`:${test.location.line}:${test.location.column}`)
    }
    name += separator
    name += getTestName(test, separator)
    return name
  }

  protected getTestIndentation(test: Task): string {
    return '  '.repeat(getIndentation(test))
  }

  protected printAnnotations(test: TestCase, console: 'log' | 'error', padding = 0): void {
    const annotations = test.annotations()
    if (!annotations.length) {
      return
    }

    const PADDING = ' '.repeat(padding)

    const groupedAnnotations: Record<string, TestAnnotation[]> = {}

    annotations.forEach((annotation) => {
      const { location, type } = annotation
      let group: string
      if (location) {
        const file = relative(test.project.config.root, location.file)
        group = `${c.gray(`${file}:${location.line}:${location.column}`)} ${c.bold(type)}`
      }
      else {
        group = c.bold(type)
      }

      groupedAnnotations[group] ??= []
      groupedAnnotations[group].push(annotation)
    })

    for (const group in groupedAnnotations) {
      this[console](`${PADDING}${c.blue(F_POINTER)} ${group}`)
      groupedAnnotations[group].forEach(({ message }) => {
        this[console](`${PADDING}  ${c.blue(F_DOWN_RIGHT)} ${message}`)
      })
    }
  }

  protected getEntityPrefix(entity: TestCase | TestModule | TestSuite): string {
    let title = this.getStateSymbol(entity)

    if (entity.project.name) {
      title += ` ${formatProjectName(entity.project, '')}`
    }

    if (entity.meta().typecheck) {
      title += ` ${c.bgBlue(c.bold(' TS '))}`
    }

    return title
  }

  protected getTestCaseSuffix(testCase: TestCase): string {
    const { heap, retryCount, repeatCount } = testCase.diagnostic() || {}
    const testResult = testCase.result()
    let suffix = this.getDurationPrefix(testCase.task)

    if (retryCount != null && retryCount > 0) {
      suffix += c.yellow(` (retry x${retryCount})`)
    }

    if (repeatCount != null && repeatCount > 0) {
      suffix += c.yellow(` (repeat x${repeatCount})`)
    }

    if (heap != null) {
      suffix += c.magenta(` ${Math.floor(heap / 1024 / 1024)} MB heap used`)
    }

    if (testResult.state === 'skipped' && testResult.note) {
      suffix += c.dim(c.gray(` [${testResult.note}]`))
    }

    return suffix
  }

  protected getStateSymbol(test: TestCase | TestModule | TestSuite): string {
    return getStateSymbol(test.task)
  }

  private getDurationPrefix(task: Task): string {
    const duration = task.result?.duration && Math.round(task.result?.duration)
    if (duration == null) {
      return ''
    }

    const color = duration > this.ctx.config.slowTestThreshold
      ? c.yellow
      : c.green

    return color(` ${duration}${c.dim('ms')}`)
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
      headerText = this.getFullName(task, separator)
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
        return false
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

    const leakCount = this.printLeaksSummary()

    if (this.ctx.config.mode === 'benchmark') {
      this.reportBenchmarkSummary(files)
    }
    else {
      this.reportTestSummary(files, errors, leakCount)
    }
  }

  reportTestSummary(files: File[], errors: unknown[], leakCount: number): void {
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

    if (leakCount) {
      this.log(padSummaryTitle('Leaks'), c.bold(c.red(`${leakCount} leak${leakCount > 1 ? 's' : ''}`)))
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
      const transformTime = this.ctx.state.transformTime
      const typecheck = sum(this.ctx.projects, project => project.typechecker?.getResult().time)

      const timers = [
        `transform ${formatTime(transformTime)}`,
        `setup ${formatTime(setupTime)}`,
        `import ${formatTime(collectTime)}`,
        `tests ${formatTime(testsTime)}`,
        `environment ${formatTime(environmentTime)}`,
        typecheck && `typecheck ${formatTime(typecheck)}`,
      ].filter(Boolean).join(', ')

      this.log(padSummaryTitle('Duration'), formatTime(executionTime) + c.dim(` (${timers})`))

      if (blobs?.executionTimes) {
        this.log(padSummaryTitle('Per blob') + blobs.executionTimes.map(time => ` ${formatTime(time)}`).join(''))
      }
    }

    this.reportImportDurations()

    this.log()
  }

  private reportImportDurations() {
    const { print, failOnDanger, thresholds } = this.ctx.config.experimental.importDurations
    if (!print && !failOnDanger) {
      return
    };

    const testModules = this.ctx.state.getTestModules()

    interface ImportEntry {
      importedModuleId: string
      selfTime: number
      external?: boolean
      totalTime: number
      testModule: TestModule
    }

    const allImports: ImportEntry[] = []

    for (const testModule of testModules) {
      const diagnostic = testModule.diagnostic()
      const importDurations = diagnostic.importDurations

      for (const filePath in importDurations) {
        const duration = importDurations[filePath]
        allImports.push({
          importedModuleId: filePath,
          testModule,
          selfTime: duration.selfTime,
          totalTime: duration.totalTime,
          external: duration.external,
        })
      }
    }

    if (allImports.length === 0) {
      return
    }

    const dangerImports = allImports.filter(imp => imp.totalTime >= thresholds.danger)
    const warnImports = allImports.filter(imp => imp.totalTime >= thresholds.warn)
    const hasDangerImports = dangerImports.length > 0
    const hasWarnImports = warnImports.length > 0

    // Determine if we should print
    const shouldFail = failOnDanger && hasDangerImports
    const shouldPrint = (print === true) || (print === 'on-warn' && hasWarnImports) || shouldFail
    if (!shouldPrint) {
      return
    }

    const sortedImports = allImports.sort((a, b) => b.totalTime - a.totalTime)
    const maxTotalTime = sortedImports[0].totalTime
    const limit = this.ctx.config.experimental.importDurations.limit
    const topImports = sortedImports.slice(0, limit)

    const totalSelfTime = allImports.reduce((sum, imp) => sum + imp.selfTime, 0)
    const totalTotalTime = allImports.reduce((sum, imp) => sum + imp.totalTime, 0)
    const slowestImport = sortedImports[0]

    this.log()
    this.log(c.bold('Import Duration Breakdown') + c.dim(` (Top ${limit})`))
    this.log()
    this.log(c.dim(`${'Module'.padEnd(50)} ${'Self'.padStart(6)} ${'Total'.padStart(6)}`))

    // if there are multiple files, it's highly possible that some of them will import the same large file
    // we group them to show the distinction between those files more easily
    //     Import Duration Breakdown (Top 10)
    //
    //     Module                                              Self     Total
    //     .../fields/FieldFile/__tests__/FieldFile.spec.ts     7ms    1.01s  ████████████████████
    //      ↳ tests/support/components/index.ts                 0ms     861ms █████████████████░░░
    //      ↳ tests/support/components/renderComponent.ts      59ms     861ms █████████████████░░░
    //     ...s__/apps/desktop/form-updater.desktop.spec.ts     8ms     991ms ████████████████████
    //     ...sts__/apps/mobile/form-updater.mobile.spec.ts    11ms     990ms ████████████████████
    //     shared/components/Form/__tests__/Form.spec.ts        5ms     988ms ████████████████████
    //      ↳ tests/support/components/index.ts                 0ms     935ms ███████████████████░
    //      ↳ tests/support/components/renderComponent.ts      61ms     935ms ███████████████████░
    //     ...ditor/features/link/__test__/LinkForm.spec.ts     7ms     972ms ███████████████████░
    //      ↳ tests/support/components/renderComponent.ts      56ms     936ms ███████████████████░

    const groupedImports = Object.entries(
      groupBy(topImports, i => i.testModule.id),
      // the first one is always the highest because the modules are already sorted
    ).sort(([, imps1], [, imps2]) => imps2[0].totalTime - imps1[0].totalTime)

    for (const [_, group] of groupedImports) {
      group.forEach((imp, index) => {
        const barWidth = 20
        const filledWidth = Math.round((imp.totalTime / maxTotalTime) * barWidth)
        const bar = c.cyan('█'.repeat(filledWidth)) + c.dim('░'.repeat(barWidth - filledWidth))

        // only show the arrow if there is more than 1 group
        const pathDisplay = this.ellipsisPath(imp.importedModuleId, imp.external, groupedImports.length > 1 && index > 0)

        this.log(
          `${pathDisplay} ${this.importDurationTime(imp.selfTime)} ${this.importDurationTime(imp.totalTime)}  ${bar}`,
        )
      })
    }

    this.log()
    this.log(c.dim('Total imports: ') + allImports.length)
    this.log(c.dim('Slowest import (total-time): ') + formatTime(slowestImport.totalTime))
    this.log(c.dim('Total import time (self/total): ') + formatTime(totalSelfTime) + c.dim(' / ') + formatTime(totalTotalTime))

    // Fail if danger threshold exceeded
    if (shouldFail) {
      this.log()
      this.ctx.logger.error(
        `ERROR: ${dangerImports.length} import(s) exceeded the danger threshold of ${thresholds.danger}ms`,
      )
      process.exitCode = 1
    }
  }

  private importDurationTime(duration: number) {
    const { thresholds } = this.ctx.config.experimental.importDurations
    const color = duration >= thresholds.danger ? c.red : duration >= thresholds.warn ? c.yellow : (c: string) => c
    return color(formatTime(duration).padStart(6))
  }

  private ellipsisPath(path: string, external: boolean | undefined, nested: boolean) {
    const pathDisplay = this.relative(path)
    const color = external ? c.magenta : (c: string) => c
    const slicedPath = pathDisplay.slice(-44)
    let title = ''
    if (pathDisplay.length > slicedPath.length) {
      title += '...'
    }
    if (nested) {
      title = ` ${F_DOWN_RIGHT} ${title}`
    }
    title += slicedPath
    return color(title.padEnd(50))
  }

  private printErrorsSummary(files: File[], errors: unknown[]) {
    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.errors)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = countTestErrors(failedSuites) + countTestErrors(failedTests)

    // TODO: error divider should take into account merged errors for counting
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

  private printLeaksSummary() {
    const leaks = this.ctx.state.leakSet

    if (leaks.size === 0) {
      return 0
    }

    const leakWithStacks = new Map<string, { leak: AsyncLeak; stacks: ParsedStack[] }>()

    // Leaks can be duplicate, where type and position are identical
    for (const leak of leaks) {
      const stacks = parseStacktrace(leak.stack)

      if (stacks.length === 0) {
        continue
      }

      const filename = this.relative(leak.filename)
      const key = `${filename}:${stacks[0].line}:${stacks[0].column}:${leak.type}`

      if (leakWithStacks.has(key)) {
        continue
      }

      leakWithStacks.set(key, { leak, stacks })
    }

    this.error(`\n${errorBanner(`Async Leaks ${leakWithStacks.size}`)}\n`)

    for (const { leak, stacks } of leakWithStacks.values()) {
      const filename = this.relative(leak.filename)
      this.ctx.logger.error(c.red(`${leak.type} leaking in ${filename}`))

      try {
        const sourceCode = readFileSync(stacks[0].file, 'utf-8')

        this.ctx.logger.error(generateCodeFrame(
          sourceCode.length > 100_000
            ? sourceCode
            : this.ctx.logger.highlight(stacks[0].file, sourceCode),
          undefined,
          stacks[0],
        ))
      }
      catch {
        // ignore error, do not produce more detailed message with code frame.
      }

      printStack(
        this.ctx.logger,
        this.ctx.getProjectByName(leak.projectName),
        stacks,
        stacks[0],
        {},
      )
    }

    return leakWithStacks.size
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

      const groupName = this.getFullName(group, separator)
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
            if (i[0]?.stack !== error.stack || i[0]?.diff !== error.diff) {
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

        let name = this.getFullName(task, separator)

        if (filepath) {
          name += c.dim(` [ ${this.relative(filepath)} ]`)
        }

        this.ctx.logger.error(
          `${c.bgRed(c.bold(' FAIL '))} ${formatProjectName(project)}${name}`,
        )
      }

      const screenshotPaths = tasks.reduce<string[]>((paths, t) => {
        if (t.type === 'test') {
          for (const artifact of t.artifacts) {
            if (artifact.type === 'internal:failureScreenshot') {
              if (artifact.attachments.length) {
                paths.push(artifact.attachments[0].originalPath)
              }
            }
          }
        }

        return paths
      }, [])

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

function getIndentation(suite: Task, level = 1): number {
  if (suite.suite && !('filepath' in suite.suite)) {
    return getIndentation(suite.suite, level + 1)
  }

  return level
}
