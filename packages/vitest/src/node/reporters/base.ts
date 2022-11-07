import { performance } from 'perf_hooks'
import c from 'picocolors'
import type { ErrorWithDiff, File, Reporter, Task, TaskResultPack, UserConsoleLog } from '../../types'
import { clearInterval, getFullName, getSuites, getTests, getTypecheckTests, hasFailed, hasFailedSnapshot, isNode, relativePath, setInterval } from '../../utils'
import type { Vitest } from '../../node'
import { F_RIGHT } from '../../utils/figures'
import { divider, formatTimeString, getStateString, getStateSymbol, pointer, renderSnapshotSummary } from './renderers/utils'

const BADGE_PADDING = '       '
const HELP_HINT = `${c.dim('press ')}${c.bold('h')}${c.dim(' to show help')}`
const HELP_UPDATE_SNAP = c.dim('press ') + c.bold(c.yellow('u')) + c.dim(' to update snapshot')
const HELP_QUITE = `${c.dim('press ')}${c.bold('q')}${c.dim(' to quit')}`

const WAIT_FOR_CHANGE_PASS = `\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`
const WAIT_FOR_CHANGE_FAIL = `\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(' Tests failed. Watching for file changes...')}`

const DURATION_LONG = 300
const LAST_RUN_LOG_TIMEOUT = 1_500

export abstract class BaseReporter implements Reporter {
  start = 0
  end = 0
  watchFilters?: string[]
  isTTY = isNode && process.stdout?.isTTY && !process.env.CI
  ctx: Vitest = undefined!

  private _filesInWatchMode = new Map<string, number>()
  private _lastRunTimeout = 0
  private _lastRunTimer: NodeJS.Timer | undefined
  private _lastRunCount = 0
  private _timeStart = new Date()

  constructor() {
    this.registerUnhandledRejection()
  }

  get mode() {
    return this.ctx.config.mode
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx

    ctx.logger.printBanner()
    this.start = performance.now()
  }

  relative(path: string) {
    return relativePath(this.ctx.config.root, path)
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.end = performance.now()
    await this.reportSummary(files)
    if (errors.length) {
      if (!this.ctx.config.dangerouslyIgnoreUnhandledErrors)
        process.exitCode = 1
      await this.ctx.logger.printUnhandledErrors(errors)
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
          const color = task.result.duration > DURATION_LONG ? c.yellow : c.gray
          suffix += color(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
        }
        if (this.ctx.config.logHeapUsage && task.result.heap != null)
          suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

        logger.log(` ${getStateSymbol(task)} ${task.name} ${suffix}`)

        // print short errors, full errors will be at the end in summary
        for (const test of failed) {
          logger.log(c.red(`   ${pointer} ${getFullName(test)}`))
          logger.log(c.red(`     ${F_RIGHT} ${(test.result!.error as any)?.message}`))
        }
      }
    }
  }

  async onWatcherStart(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.resetLastRunLog()

    const failed = errors.length > 0 || hasFailed(files)
    const failedSnap = hasFailedSnapshot(files)
    if (failed)
      this.ctx.logger.log(WAIT_FOR_CHANGE_FAIL)
    else
      this.ctx.logger.log(WAIT_FOR_CHANGE_PASS)

    const hints = []
    // TODO typecheck doesn't support these for now
    if (this.mode !== 'typecheck')
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
    if (files.length > 1) {
      // we need to figure out how to handle rerun all from stdin
      this.ctx.logger.clearFullScreen(`\n${BADGE}${TRIGGER}\n`)
      this._lastRunCount = 0
    }
    else if (files.length === 1) {
      const rerun = this._filesInWatchMode.get(files[0]) ?? 1
      this._lastRunCount = rerun
      this.ctx.logger.clearFullScreen(`\n${BADGE}${TRIGGER} ${c.blue(`x${rerun}`)}\n`)
    }

    this._timeStart = new Date()
    this.start = performance.now()
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined
    this.ctx.logger.log(c.gray(log.type + c.dim(` | ${task ? getFullName(task) : 'unknown test'}`)))
    process[log.type].write(`${log.content}\n`)
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

  async reportSummary(files: File[]) {
    await this.printErrorsSummary(files)
    if (this.mode === 'benchmark')
      await this.reportBenchmarkSummary(files)
    else
      await this.reportTestSummary(files)
  }

  async reportTestSummary(files: File[]) {
    const tests = this.mode === 'typecheck' ? getTypecheckTests(files) : getTests(files)
    const logger = this.ctx.logger

    const executionTime = this.end - this.start
    const collectTime = files.reduce((acc, test) => acc + Math.max(0, test.collectDuration || 0), 0)
    const setupTime = files.reduce((acc, test) => acc + Math.max(0, test.setupDuration || 0), 0)
    const testsTime = files.reduce((acc, test) => acc + Math.max(0, test.result?.duration || 0), 0)
    const transformTime = Array.from(this.ctx.vitenode.fetchCache.values()).reduce((a, b) => a + (b?.duration || 0), 0)
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
    if (this.mode === 'typecheck') {
      // has only failed checks
      const typechecks = getTests(files).filter(t => t.type === 'typecheck')
      logger.log(padTitle('Type Errors'), getStateString(typechecks, 'errors', false))
    }
    logger.log(padTitle('Start at'), formatTimeString(this._timeStart))
    if (this.watchFilters)
      logger.log(padTitle('Duration'), time(threadTime))
    else if (this.mode === 'typecheck')
      logger.log(padTitle('Duration'), time(executionTime))
    else
      logger.log(padTitle('Duration'), time(executionTime) + c.dim(` (transform ${time(transformTime)}, setup ${time(setupTime)}, collect ${time(collectTime)}, tests ${time(testsTime)})`))

    logger.log()
  }

  private async printErrorsSummary(files: File[]) {
    const logger = this.ctx.logger
    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.error)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = failedSuites.length + failedTests.length

    let current = 1

    const errorDivider = () => logger.error(`${c.red(c.dim(divider(`[${current++}/${failedTotal}]`, undefined, 1)))}\n`)

    if (failedSuites.length) {
      logger.error(c.red(divider(c.bold(c.inverse(` Failed Suites ${failedSuites.length} `)))))
      logger.error()
      await this.printTaskErrors(failedSuites, errorDivider)
    }

    if (failedTests.length) {
      const message = this.mode === 'typecheck' ? 'Type Errors' : 'Failed Tests'
      logger.error(c.red(divider(c.bold(c.inverse(` ${message} ${failedTests.length} `)))))
      logger.error()

      await this.printTaskErrors(failedTests, errorDivider)
    }
    return tests
  }

  async reportBenchmarkSummary(files: File[]) {
    const logger = this.ctx.logger
    const benchs = getTests(files)

    const topBenchs = benchs.filter(i => i.result?.benchmark?.rank === 1)

    logger.log(`\n${c.cyan(c.inverse(c.bold(' BENCH ')))} ${c.cyan('Summary')}\n`)
    for (const bench of topBenchs) {
      const group = bench.suite
      if (!group)
        continue
      const groupName = getFullName(group)
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
      const error = task.result?.error
      const errorItem = error?.stackStr && errorsQueue.find(i => i[0]?.stackStr === error.stackStr)
      if (errorItem)
        errorItem[1].push(task)
      else
        errorsQueue.push([error, [task]])
    }
    for (const [error, tasks] of errorsQueue) {
      for (const task of tasks) {
        const filepath = (task as File)?.filepath || ''
        let name = getFullName(task)
        if (filepath)
          name = `${name} ${c.dim(`[ ${this.relative(filepath)} ]`)}`

        this.ctx.logger.error(`${c.red(c.bold(c.inverse(' FAIL ')))} ${name}`)
      }
      await this.ctx.logger.printError(error)
      errorDivider()
      await Promise.resolve()
    }
  }

  registerUnhandledRejection() {
    process.on('unhandledRejection', async (err) => {
      process.exitCode = 1
      await this.ctx.logger.printError(err, true, 'Unhandled Rejection')
      this.ctx.logger.error('\n\n')
      process.exit(1)
    })
  }
}
