import { performance } from 'node:perf_hooks'
import c from 'picocolors'
import type { ErrorWithDiff, File, Reporter, Task, TaskResultPack, UserConsoleLog } from '../../types'
import { getFullName, getSafeTimers, getSuites, getTests, hasFailed, hasFailedSnapshot, isCI, isNode, relativePath, toArray } from '../../utils'
import type { Vitest } from '../../node'
import { F_RIGHT } from '../../utils/figures'
import { UNKNOWN_TEST_ID } from '../../runtime/console'
import { countTestErrors, divider, formatProjectName, formatTimeString, getStateString, getStateSymbol, pointer, renderSnapshotSummary } from './renderers/utils'

const BADGE_PADDING = '       '
const HELP_HINT = `${c.dim('press ')}${c.bold('h')}${c.dim(' to show help')}`
const HELP_UPDATE_SNAP = c.dim('press ') + c.bold(c.yellow('u')) + c.dim(' to update snapshot')
const HELP_QUITE = `${c.dim('press ')}${c.bold('q')}${c.dim(' to quit')}`

const WAIT_FOR_CHANGE_PASS = `\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`
const WAIT_FOR_CHANGE_FAIL = `\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(' Tests failed. Watching for file changes...')}`
const WAIT_FOR_CHANGE_CANCELLED = `\n${c.bold(c.inverse(c.red(' CANCELLED ')))}${c.red(' Test run cancelled. Watching for file changes...')}`

const LAST_RUN_LOG_TIMEOUT = 1_500

export abstract class BaseReporter implements Reporter {
  start = 0
  end = 0
  watchFilters?: string[]
  isTTY = isNode && process.stdout?.isTTY && !isCI
  ctx: Vitest = undefined!

  private _filesInWatchMode = new Map<string, number>()
  private _lastRunTimeout = 0
  private _lastRunTimer: NodeJS.Timer | undefined
  private _lastRunCount = 0
  private _timeStart = new Date()
  private _offUnhandledRejection?: () => void

  constructor() {
    this.registerUnhandledRejection()
  }

  get mode() {
    return this.ctx.config.mode
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx
    ctx.onClose(() => {
      this._offUnhandledRejection?.()
    })
    ctx.logger.printBanner()
    this.start = performance.now()
  }

  relative(path: string) {
    return relativePath(this.ctx.config.root, path)
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.end = performance.now()

    await this.reportSummary(files, errors)
    if (errors.length) {
      if (!this.ctx.config.dangerouslyIgnoreUnhandledErrors)
        process.exitCode = 1
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    const logger = this.ctx.logger
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && 'filepath' in task && task.result?.state && task.result?.state !== 'run') {
        const tests = getTests(task)
        const failed = tests.filter(t => t.result?.state === 'fail')
        const skipped = tests.filter(t => t.mode === 'skip' || t.mode === 'todo')
        let state = c.dim(`${tests.length} test${tests.length > 1 ? 's' : ''}`)
        if (failed.length)
          state += ` ${c.dim('|')} ${c.red(`${failed.length} failed`)}`
        if (skipped.length)
          state += ` ${c.dim('|')} ${c.yellow(`${skipped.length} skipped`)}`
        let suffix = c.dim(' (') + state + c.dim(')')
        if (task.result.duration) {
          const color = task.result.duration > this.ctx.config.slowTestThreshold ? c.yellow : c.gray
          suffix += color(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
        }
        if (this.ctx.config.logHeapUsage && task.result.heap != null)
          suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

        let title = ` ${getStateSymbol(task)} `
        if (task.projectName)
          title += formatProjectName(task.projectName)
        title += `${task.name} ${suffix}`
        logger.log(title)

        // print short errors, full errors will be at the end in summary
        for (const test of failed) {
          logger.log(c.red(`   ${pointer} ${getFullName(test, c.dim(' > '))}`))
          test.result?.errors?.forEach((e) => {
            logger.log(c.red(`     ${F_RIGHT} ${(e as any)?.message}`))
          })
        }
      }
    }
  }

  async onWatcherStart(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.resetLastRunLog()

    const failed = errors.length > 0 || hasFailed(files)
    const failedSnap = hasFailedSnapshot(files)
    const cancelled = this.ctx.isCancelling

    if (failed)
      this.ctx.logger.log(WAIT_FOR_CHANGE_FAIL)
    else if (cancelled)
      this.ctx.logger.log(WAIT_FOR_CHANGE_CANCELLED)
    else
      this.ctx.logger.log(WAIT_FOR_CHANGE_PASS)

    const hints: string[] = []
    hints.push(HELP_HINT)
    if (failedSnap)
      hints.unshift(HELP_UPDATE_SNAP)
    else
      hints.push(HELP_QUITE)

    this.ctx.logger.log(BADGE_PADDING + hints.join(c.dim(', ')))

    if (this._lastRunCount) {
      const LAST_RUN_TEXT = `rerun x${this._lastRunCount}`
      const LAST_RUN_TEXTS = [
        c.blue(LAST_RUN_TEXT),
        c.gray(LAST_RUN_TEXT),
        c.dim(c.gray(LAST_RUN_TEXT)),
      ]
      this.ctx.logger.logUpdate(BADGE_PADDING + LAST_RUN_TEXTS[0])
      this._lastRunTimeout = 0
      const { setInterval } = getSafeTimers()
      this._lastRunTimer = setInterval(
        () => {
          this._lastRunTimeout += 1
          if (this._lastRunTimeout >= LAST_RUN_TEXTS.length)
            this.resetLastRunLog()
          else
            this.ctx.logger.logUpdate(BADGE_PADDING + LAST_RUN_TEXTS[this._lastRunTimeout])
        },
        LAST_RUN_LOG_TIMEOUT / LAST_RUN_TEXTS.length,
      )
    }
  }

  private resetLastRunLog() {
    const { clearInterval } = getSafeTimers()
    clearInterval(this._lastRunTimer)
    this._lastRunTimer = undefined
    this.ctx.logger.logUpdate.clear()
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    this.resetLastRunLog()
    this.watchFilters = files

    files.forEach((filepath) => {
      let reruns = this._filesInWatchMode.get(filepath) ?? 0
      this._filesInWatchMode.set(filepath, ++reruns)
    })

    const BADGE = c.inverse(c.bold(c.blue(' RERUN ')))
    const TRIGGER = trigger ? c.dim(` ${this.relative(trigger)}`) : ''
    const FILENAME_PATTERN = this.ctx.filenamePattern ? `${BADGE_PADDING} ${c.dim('Filename pattern: ')}${c.blue(this.ctx.filenamePattern)}\n` : ''
    const TESTNAME_PATTERN = this.ctx.configOverride.testNamePattern ? `${BADGE_PADDING} ${c.dim('Test name pattern: ')}${c.blue(String(this.ctx.configOverride.testNamePattern))}\n` : ''
    const PROJECT_FILTER = this.ctx.configOverride.project ? `${BADGE_PADDING} ${c.dim('Project name: ')}${c.blue(toArray(this.ctx.configOverride.project).join(', '))}\n` : ''

    if (files.length > 1 || !files.length) {
      // we need to figure out how to handle rerun all from stdin
      this.ctx.logger.clearFullScreen(`\n${BADGE}${TRIGGER}\n${PROJECT_FILTER}${FILENAME_PATTERN}${TESTNAME_PATTERN}`)
      this._lastRunCount = 0
    }
    else if (files.length === 1) {
      const rerun = this._filesInWatchMode.get(files[0]) ?? 1
      this._lastRunCount = rerun
      this.ctx.logger.clearFullScreen(`\n${BADGE}${TRIGGER} ${c.blue(`x${rerun}`)}\n${PROJECT_FILTER}${FILENAME_PATTERN}${TESTNAME_PATTERN}`)
    }

    this._timeStart = new Date()
    this.start = performance.now()
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined
    const header = c.gray(log.type + c.dim(` | ${task ? getFullName(task, c.dim(' > ')) : log.taskId !== UNKNOWN_TEST_ID ? log.taskId : 'unknown test'}`))
    process[log.type].write(`${header}\n${log.content}\n`)
  }

  shouldLog(log: UserConsoleLog) {
    if (this.ctx.config.silent)
      return false
    const shouldLog = this.ctx.config.onConsoleLog?.(log.content, log.type)
    if (shouldLog === false)
      return shouldLog
    return true
  }

  onServerRestart(reason?: string) {
    this.ctx.logger.log(c.bold(c.magenta(
      reason === 'config'
        ? '\nRestarting due to config changes...'
        : '\nRestarting Vitest...',
    )))
  }

  async reportSummary(files: File[], errors: unknown[]) {
    await this.printErrorsSummary(files, errors)
    if (this.mode === 'benchmark')
      await this.reportBenchmarkSummary(files)
    else
      await this.reportTestSummary(files, errors)
  }

  async reportTestSummary(files: File[], errors: unknown[]) {
    const tests = getTests(files)
    const logger = this.ctx.logger

    const executionTime = this.end - this.start
    const collectTime = files.reduce((acc, test) => acc + Math.max(0, test.collectDuration || 0), 0)
    const setupTime = files.reduce((acc, test) => acc + Math.max(0, test.setupDuration || 0), 0)
    const testsTime = files.reduce((acc, test) => acc + Math.max(0, test.result?.duration || 0), 0)
    const transformTime = this.ctx.projects
      .flatMap(w => Array.from(w.vitenode.fetchCache.values()).map(i => i.duration || 0))
      .reduce((a, b) => a + b, 0)
    const environmentTime = files.reduce((acc, file) => acc + Math.max(0, file.environmentLoad || 0), 0)
    const prepareTime = files.reduce((acc, file) => acc + Math.max(0, file.prepareDuration || 0), 0)
    const threadTime = collectTime + testsTime + setupTime

    const padTitle = (str: string) => c.dim(`${str.padStart(11)} `)
    const time = (time: number) => {
      if (time > 1000)
        return `${(time / 1000).toFixed(2)}s`
      return `${Math.round(time)}ms`
    }

    // show top 10 costly transform module
    // console.log(Array.from(this.ctx.vitenode.fetchCache.entries()).filter(i => i[1].duration)
    //   .sort((a, b) => b[1].duration! - a[1].duration!)
    //   .map(i => `${time(i[1].duration!)} ${i[0]}`)
    //   .slice(0, 10)
    //   .join('\n'),
    // )

    const snapshotOutput = renderSnapshotSummary(this.ctx.config.root, this.ctx.snapshot.summary)
    if (snapshotOutput.length) {
      logger.log(snapshotOutput.map((t, i) => i === 0
        ? `${padTitle('Snapshots')} ${t}`
        : `${padTitle('')} ${t}`,
      ).join('\n'))
      if (snapshotOutput.length > 1)
        logger.log()
    }

    logger.log(padTitle('Test Files'), getStateString(files))
    logger.log(padTitle('Tests'), getStateString(tests))
    if (this.ctx.projects.some(c => c.config.typecheck.enabled)) {
      const failed = tests.filter(t => t.meta?.typecheck && t.result?.errors?.length)
      logger.log(padTitle('Type Errors'), failed.length ? c.bold(c.red(`${failed.length} failed`)) : c.dim('no errors'))
    }
    if (errors.length)
      logger.log(padTitle('Errors'), c.bold(c.red(`${errors.length} error${errors.length > 1 ? 's' : ''}`)))
    logger.log(padTitle('Start at'), formatTimeString(this._timeStart))
    if (this.watchFilters) {
      logger.log(padTitle('Duration'), time(threadTime))
    }
    else {
      let timers = `transform ${time(transformTime)}, setup ${time(setupTime)}, collect ${time(collectTime)}, tests ${time(testsTime)}, environment ${time(environmentTime)}, prepare ${time(prepareTime)}`
      const typecheck = this.ctx.projects.reduce((acc, c) => acc + (c.typechecker?.getResult().time || 0), 0)
      if (typecheck)
        timers += `, typecheck ${time(typecheck)}`
      logger.log(padTitle('Duration'), time(executionTime) + c.dim(` (${timers})`))
    }

    logger.log()
  }

  private async printErrorsSummary(files: File[], errors: unknown[]) {
    const logger = this.ctx.logger
    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.errors)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = countTestErrors(failedSuites) + countTestErrors(failedTests)

    let current = 1

    const errorDivider = () => logger.error(`${c.red(c.dim(divider(`[${current++}/${failedTotal}]`, undefined, 1)))}\n`)

    if (failedSuites.length) {
      logger.error(c.red(divider(c.bold(c.inverse(` Failed Suites ${failedSuites.length} `)))))
      logger.error()
      await this.printTaskErrors(failedSuites, errorDivider)
    }

    if (failedTests.length) {
      logger.error(c.red(divider(c.bold(c.inverse(` Failed Tests ${failedTests.length} `)))))
      logger.error()

      await this.printTaskErrors(failedTests, errorDivider)
    }
    if (errors.length) {
      await logger.printUnhandledErrors(errors)
      logger.error()
    }
    return tests
  }

  async reportBenchmarkSummary(files: File[]) {
    const logger = this.ctx.logger
    const benches = getTests(files)

    const topBenches = benches.filter(i => i.result?.benchmark?.rank === 1)

    logger.log(`\n${c.cyan(c.inverse(c.bold(' BENCH ')))} ${c.cyan('Summary')}\n`)
    for (const bench of topBenches) {
      const group = bench.suite
      if (!group)
        continue
      const groupName = getFullName(group, c.dim(' > '))
      logger.log(`  ${bench.name}${c.dim(` - ${groupName}`)}`)
      const siblings = group.tasks
        .filter(i => i.result?.benchmark && i !== bench)
        .sort((a, b) => a.result!.benchmark!.rank - b.result!.benchmark!.rank)
      for (const sibling of siblings) {
        const number = `${(sibling.result!.benchmark!.mean / bench.result!.benchmark!.mean).toFixed(2)}x`
        logger.log(`    ${c.green(number)} ${c.gray('faster than')} ${sibling.name}`)
      }
      logger.log('')
    }
  }

  private async printTaskErrors(tasks: Task[], errorDivider: () => void) {
    const errorsQueue: [error: ErrorWithDiff | undefined, tests: Task[]][] = []
    for (const task of tasks) {
      // merge identical errors
      task.result?.errors?.forEach((error) => {
        const errorItem = error?.stackStr && errorsQueue.find((i) => {
          const hasStr = i[0]?.stackStr === error.stackStr
          if (!hasStr)
            return false
          const currentProjectName = (task as File)?.projectName || task.file?.projectName
          const projectName = (i[1][0] as File)?.projectName || i[1][0].file?.projectName
          return projectName === currentProjectName
        })
        if (errorItem)
          errorItem[1].push(task)
        else
          errorsQueue.push([error, [task]])
      })
    }
    for (const [error, tasks] of errorsQueue) {
      for (const task of tasks) {
        const filepath = (task as File)?.filepath || ''
        const projectName = (task as File)?.projectName || task.file?.projectName
        let name = getFullName(task, c.dim(' > '))
        if (filepath)
          name = `${name} ${c.dim(`[ ${this.relative(filepath)} ]`)}`

        this.ctx.logger.error(`${c.red(c.bold(c.inverse(' FAIL ')))} ${formatProjectName(projectName)}${name}`)
      }
      const project = this.ctx.getProjectByTaskId(tasks[0].id)
      await this.ctx.logger.printError(error, { project })
      errorDivider()
      await Promise.resolve()
    }
  }

  registerUnhandledRejection() {
    const onUnhandledRejection = async (err: unknown) => {
      process.exitCode = 1
      await this.ctx.logger.printError(err, { fullStack: true, type: 'Unhandled Rejection' })
      this.ctx.logger.error('\n\n')
      process.exit(1)
    }
    process.on('unhandledRejection', onUnhandledRejection)
    this._offUnhandledRejection = () => {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  }
}
