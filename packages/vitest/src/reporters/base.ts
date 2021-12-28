import { performance } from 'perf_hooks'
import { relative } from 'pathe'
import c from 'picocolors'
import type { File, Reporter, Task, TaskResultPack, UserConsoleLog } from '../types'
import { getFullName, getSuites, getTests, hasFailed } from '../utils'
import type { Vitest } from '../node'
import type { ErrorWithDiff } from './renderers/diff'
import { printError } from './renderers/diff'
import { F_RIGHT } from './renderers/figures'
import { divider, getStateString, getStateSymbol, renderSnapshotSummary } from './renderers/utils'

export abstract class BaseReporter implements Reporter {
  start = 0
  end = 0
  watchFilters?: string[]
  isTTY = process.stdout.isTTY && !process.env.CI
  ctx: Vitest = undefined!

  onInit(ctx: Vitest) {
    this.ctx = ctx
    const mode = this.ctx.config.watch
      ? c.blue(' WATCH ')
      : c.cyan(' RUN ')
    this.ctx.log(`\n${c.inverse(c.bold(mode))} ${c.gray(this.ctx.config.root)}\n`)
    this.start = performance.now()
  }

  relative(path: string) {
    return relative(this.ctx.config.root, path)
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.end = performance.now()
    await this.reportSummary(files)
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && task.type === 'test' && task.result?.state && task.result?.state !== 'run') {
        this.ctx.log(` ${getStateSymbol(task)} ${getFullName(task)}`)
        if (task.result.state === 'fail')
          this.ctx.log(c.red(`   ${F_RIGHT} ${(task.result.error as any)?.message}`))
      }
    }
  }

  isFirstWatchRun = true

  async onWatcherStart() {
    const failed = hasFailed(this.ctx.state.getFiles())
    if (failed)
      this.ctx.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(' Tests failed. Watching for file changes...')}`)
    else
      this.ctx.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`)

    if (this.isFirstWatchRun) {
      this.isFirstWatchRun = false
      this.ctx.log(c.gray('press any key to exit...'))
    }
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    this.watchFilters = files

    this.ctx.console.clear()
    this.ctx.log(c.blue('Re-running tests...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''))
    this.start = performance.now()
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (this.ctx.config.silent)
      return
    const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined
    this.ctx.log(c.gray(log.type + c.dim(` | ${task ? getFullName(task) : 'unknown test'}`)))
    process[log.type].write(`${log.content}\n`)
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
    const threadTime = tests.reduce((acc, test) => acc + (test.result?.end ? test.result.end - test.result.start : 0), 0)

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
      const error = task.result?.error as ErrorWithDiff | undefined
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
      await printError(error, this.ctx)
      errorDivider()
    }
  }
}
