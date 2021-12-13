import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import type { Reporter, TaskResultPack, UserConsoleLog, VitestContext } from '../types'
import { getSuites, getTests } from '../utils'
import { printError } from './error'
import { createRenderer, getStateString, getStateSymbol, renderSnapshotSummary, getFullName, divider } from './renderer'
import { F_RIGHT } from './figures'

const isTTY = process.stdout.isTTY && !process.env.CI

export class DefaultReporter implements Reporter {
  start = 0
  end = 0
  renderer?: ReturnType<typeof createRenderer>
  watchFilters?: string[]
  console = globalThis.console

  log(...args: any[]) {
    if (this.ctx.config.silent)
      return
    this.console.log(...args)
  }

  error(...args: any[]) {
    if (this.ctx.config.silent)
      return
    this.console.error(...args)
  }

  constructor(public ctx: VitestContext) {
    const mode = ctx.config.watch ? c.yellow(' DEV ') : c.cyan(' RUN ')
    this.log(`${c.inverse(c.bold(mode))} ${c.gray(this.ctx.config.root)}\n`)
    this.start = performance.now()
  }

  relative(path: string) {
    return relative(this.ctx.config.root, path)
  }

  onStart() {
    if (isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createRenderer(files).start()
      else
        this.renderer.update(files)
    }
  }

  onTaskUpdate(pack: TaskResultPack) {
    if (isTTY)
      return

    const task = this.ctx.state.idMap[pack[0]]
    if (task.type === 'test' && task.result?.state && task.result?.state !== 'run') {
      this.log(` ${getStateSymbol(task)} ${getFullName(task)}`)
      if (task.result.state === 'fail')
        this.log(c.red(`   ${F_RIGHT} ${(task.result.error as any)?.message}`))
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.end = performance.now()

    await this.stopListRender()

    this.log()

    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.error)
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const failedTotal = failedSuites.length + failedTests.length

    let current = 1

    const errorDivider = () => this.error(`${c.red(c.dim(divider(`[${current++}/${failedTotal}]`, undefined, 1)))}\n`)

    if (failedSuites.length) {
      this.error(c.red(divider(c.bold(c.inverse(` Failed Suites ${failedSuites.length} `)))))
      this.error()
      for (const suite of failedSuites) {
        this.error(c.red(`\n- ${getFullName(suite)}`))
        await printError(suite.result?.error)
        errorDivider()
      }
    }

    if (failedTests.length) {
      this.error(c.red(divider(c.bold(c.inverse(` Failed Tests ${failedTests.length} `)))))
      this.error()
      for (const test of failedTests) {
        this.error(`${c.red(c.bold(c.inverse(' FAIL ')))} ${getFullName(test)}`)
        await printError(test.result?.error)
        errorDivider()
      }
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
      this.log(snapshotOutput.map((t, i) => i === 0
        ? `${padTitle('Snapshots')} ${t}`
        : `${padTitle('')} ${t}`,
      ).join('\n'))
      if (snapshotOutput.length > 1)
        this.log()
    }

    this.log(padTitle('Test Files'), getStateString(files))
    this.log(padTitle('Tests'), getStateString(tests))
    if (this.watchFilters)
      this.log(padTitle('Time'), time(threadTime))
    else
      this.log(padTitle('Time'), time(executionTime) + c.gray(` (in thread ${time(threadTime)}, ${(executionTime / threadTime * 100).toFixed(2)}%)`))

    this.log()
  }

  isFirstWatchRun = true

  async onWatcherStart() {
    await this.stopListRender()

    const failed = getTests(this.ctx.state.getFiles()).filter(i => i.result?.state === 'fail')
    if (failed.length)
      this.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(` ${failed.length} tests failed. Watching for file changes...`)}`)
    else
      this.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`)

    if (this.isFirstWatchRun) {
      this.isFirstWatchRun = false
      this.log(c.gray('press any key to exit...'))
    }
  }

  async onWatcherRerun(files: string[], trigger: string) {
    await this.stopListRender()

    this.watchFilters = files

    this.console.clear()
    this.log(c.blue('Re-running tests...') + c.dim(` [ ${this.relative(trigger)} ]\n`))
  }

  async stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  onUserConsoleLog(log: UserConsoleLog) {
    this.renderer?.clear()
    const task = log.taskId ? this.ctx.state.idMap[log.taskId] : undefined
    this.log(c.gray(log.type + c.dim(` | ${task ? getFullName(task) : 'unknown test'}`)))
    process[log.type].write(`${log.content}\n`)
  }
}
