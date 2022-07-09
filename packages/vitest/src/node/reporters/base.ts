import { performance } from 'perf_hooks'
import { relative } from 'pathe'
import c from 'picocolors'
import { createLogUpdate } from 'log-update'
import type { ErrorWithDiff, File, Reporter, Task, TaskResultPack, UserConsoleLog } from '../../types'
import { clearInterval, getFullName, getSuites, getTests, hasFailed, hasFailedSnapshot, isNode, setInterval } from '../../utils'
import type { Vitest } from '../../node'
import { version } from '../../../package.json'
import { F_RIGHT } from '../../utils/figures'
import { divider, getStateString, getStateSymbol, pointer, renderSnapshotSummary } from './renderers/utils'

const BADGE_PADDING = '       '
const HELP_HINT = `${c.dim('press ')}${c.bold('h')}${c.dim(' to show help')}`
const HELP_UPDATE_SNAP = c.dim('press ') + c.bold(c.yellow('u')) + c.dim(' to update snapshot')
const HELP_QUITE = `${c.dim('press ')}${c.bold('q')}${c.dim(' to quit')}`

const WAIT_FOR_CHANGE_PASS = `\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`
const WAIT_FOR_CHANGE_FAIL = `\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(' Tests failed. Watching for file changes...')}`

const DURATION_LONG = 300

const LAST_RUN_TEXTS = [
  'Updated',
  c.gray('Updated'),
  c.dim(c.gray('Updated')),
]
const LAST_RUN_LOG_TIMEOUT = 2_000
const LAST_RUN_LOG_INTERVAL = LAST_RUN_LOG_TIMEOUT / LAST_RUN_TEXTS.length

export abstract class BaseReporter implements Reporter {
  start = 0
  end = 0
  watchFilters?: string[]
  isTTY = isNode && process.stdout?.isTTY && !process.env.CI
  ctx: Vitest = undefined!

  private _hintRerunLog = 0
  private _hintRerunChars: string[] = ['◑', '◒', '◐', '◓']
  private _filesInWatchMode = new Map<string, number>()
  private _logUpdate: ReturnType<typeof createLogUpdate> = undefined!
  private _lastRunFinishTime = 0
  private _lastRunTimer: NodeJS.Timer | undefined

  constructor() {
    this.registerUnhandledRejection()
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx

    this.ctx.log()

    const versionTest = this.ctx.config.watch
      ? c.blue(`v${version}`)
      : c.cyan(`v${version}`)
    const mode = this.ctx.config.watch
      ? c.blue(' DEV ')
      : c.cyan(' RUN ')
    this._logUpdate = createLogUpdate(this.ctx.outputStream)
    this.ctx.log(`${c.inverse(c.bold(mode))} ${versionTest} ${c.gray(this.ctx.config.root)}`)

    if (this.ctx.config.ui)
      this.ctx.log(c.dim(c.green(`      UI started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.server.config.server.port}`)}${this.ctx.config.uiBase}`)))
    else if (this.ctx.config.api)
      this.ctx.log(c.dim(c.green(`      API started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.config.api.port}`)}`)))

    this.ctx.log()
    this.start = performance.now()
  }

  relative(path: string) {
    return relative(this.ctx.config.root, path)
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.end = performance.now()
    await this.reportSummary(files)
    if (errors.length) {
      process.exitCode = 1
      const errorMessage = c.red(c.bold(
        `\nVitest caught ${errors.length} unhandled error${errors.length > 1 ? 's' : ''} during the test run. This might cause false positive tests.`
        + '\nPlease, resolve all the errors to make sure your tests are not affected.',
      ))
      this.ctx.log(c.red(divider(c.bold(c.inverse(' Unhandled Errors ')))))
      this.ctx.log(errorMessage)
      await Promise.all(errors.map(async (err) => {
        await this.ctx.printError(err, true, (err as ErrorWithDiff).type || 'Unhandled Error')
      }))
      this.ctx.log(c.red(divider()))
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
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

        this.ctx.log(` ${getStateSymbol(task)} ${task.name} ${suffix}`)

        // print short errors, full errors will be at the end in summary
        for (const test of failed) {
          this.ctx.log(c.red(`   ${pointer} ${getFullName(test)}`))
          this.ctx.log(c.red(`     ${F_RIGHT} ${(test.result!.error as any)?.message}`))
        }
      }
    }
  }

  async onWatcherStart() {
    this.resetLastRunLog()

    const files = this.ctx.state.getFiles()
    const errors = this.ctx.state.getUnhandledErrors()
    const failed = errors.length > 0 || hasFailed(files)
    const failedSnap = hasFailedSnapshot(files)
    if (failed)
      this.ctx.log(WAIT_FOR_CHANGE_FAIL)
    else
      this.ctx.log(WAIT_FOR_CHANGE_PASS)

    const hints = [HELP_HINT]
    if (failedSnap)
      hints.unshift(HELP_UPDATE_SNAP)
    else
      hints.push(HELP_QUITE)

    this.ctx.log(BADGE_PADDING + hints.join(c.dim(', ')))
    this._logUpdate(BADGE_PADDING + LAST_RUN_TEXTS[0])
    this._lastRunFinishTime = Date.now()
    this._lastRunTimer = setInterval(() => {
      const time = Date.now()
      const delta = time - this._lastRunFinishTime
      const index = Math.round(delta / LAST_RUN_LOG_INTERVAL)
      if (delta > LAST_RUN_LOG_TIMEOUT)
        this.resetLastRunLog()
      else
        this._logUpdate(BADGE_PADDING + LAST_RUN_TEXTS[index])
    }, LAST_RUN_LOG_INTERVAL)
  }

  private resetLastRunLog() {
    clearInterval(this._lastRunTimer)
    this._lastRunTimer = undefined
    this._logUpdate.clear()
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    this.resetLastRunLog()
    this.watchFilters = files

    files.forEach((filepath) => {
      let reruns = this._filesInWatchMode.get(filepath) ?? 0
      this._filesInWatchMode.set(filepath, ++reruns)
    })

    const hint = this._hintRerunLog
    this._hintRerunLog = (hint + 1) % this._hintRerunChars.length
    const BADGE = c.inverse(c.bold(c.blue(' RERUN ')))
    const TRIGGER = trigger ? c.dim(` ${this.relative(trigger)}`) : ''
    if (files.length > 1) {
      // we need to figure out how to handle rerun all from stdin
      this.ctx.clearScreen(`\n${BADGE}${TRIGGER}\n`, true)
    }
    else if (files.length === 1) {
      const rerun = this._filesInWatchMode.get(files[0]) ?? 1
      this.ctx.clearScreen(`\n${BADGE}${TRIGGER} ${c.blue(`x${rerun}`)}\n`)
    }

    this.start = performance.now()
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined
    this.ctx.log(c.gray(log.type + c.dim(` | ${task ? getFullName(task) : 'unknown test'}`)))
    process[log.type].write(`${log.content}\n`)
  }

  shouldLog(log: UserConsoleLog) {
    if (this.ctx.config.silent)
      return false
    const shouldIgnore = this.ctx.config.onConsoleLog?.(log.content, log.type)
    if (shouldIgnore === false)
      return shouldIgnore
    return true
  }

  onServerRestart() {
    this.ctx.log(c.cyan('Restarted due to config changes...'))
  }

  async reportSummary(files: File[]) {
    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.error)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = failedSuites.length + failedTests.length

    let current = 1

    const errorDivider = () => this.ctx.error(`${c.red(c.dim(divider(`[${current++}/${failedTotal}]`, undefined, 1)))}\n`)

    if (failedSuites.length) {
      this.ctx.error(c.red(divider(c.bold(c.inverse(` Failed Suites ${failedSuites.length} `)))))
      this.ctx.error()
      await this.printTaskErrors(failedSuites, errorDivider)
    }

    if (failedTests.length) {
      this.ctx.error(c.red(divider(c.bold(c.inverse(` Failed Tests ${failedTests.length} `)))))
      this.ctx.error()

      await this.printTaskErrors(failedTests, errorDivider)
    }

    const executionTime = this.end - this.start
    const threadTime = files.reduce((acc, test) => acc + Math.max(0, test.result?.duration || 0) + Math.max(0, test.collectDuration || 0), 0)

    const padTitle = (str: string) => c.dim(`${str.padStart(10)} `)
    const time = (time: number) => {
      if (time > 1000)
        return `${(time / 1000).toFixed(2)}s`
      return `${Math.round(time)}ms`
    }

    const snapshotOutput = renderSnapshotSummary(this.ctx.config.root, this.ctx.snapshot.summary)
    if (snapshotOutput.length) {
      this.ctx.log(snapshotOutput.map((t, i) => i === 0
        ? `${padTitle('Snapshots')} ${t}`
        : `${padTitle('')} ${t}`,
      ).join('\n'))
      if (snapshotOutput.length > 1)
        this.ctx.log()
    }

    this.ctx.log(padTitle('Test Files'), getStateString(files))
    this.ctx.log(padTitle('Tests'), getStateString(tests))
    if (this.watchFilters)
      this.ctx.log(padTitle('Time'), time(threadTime))

    else
      this.ctx.log(padTitle('Time'), time(executionTime) + c.gray(` (in thread ${time(threadTime)}, ${(executionTime / threadTime * 100).toFixed(2)}%)`))

    this.ctx.log()
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

        this.ctx.error(`${c.red(c.bold(c.inverse(' FAIL ')))} ${name}`)
      }
      await this.ctx.printError(error)
      errorDivider()
      await Promise.resolve()
    }
  }

  registerUnhandledRejection() {
    process.on('unhandledRejection', async (err) => {
      process.exitCode = 1
      await this.ctx.printError(err, true, 'Unhandled Rejection')
      this.ctx.error('\n\n')
      process.exit(1)
    })
  }
}
