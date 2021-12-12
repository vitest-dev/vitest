/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import type { Reporter, TaskResultPack, VitestContext } from '../types'
import { getSuites, getTests } from '../utils'
import { printError } from './error'
import { createRenderer, getStateString, getStateSymbol, renderSnapshotSummary, getFullName } from './renderer'
import { F_RIGHT } from './figures'

const isTTY = process.stdout.isTTY && !process.env.CI

export class DefaultReporter implements Reporter {
  start = 0
  end = 0
  renderer?: ReturnType<typeof createRenderer>
  watchFilters?: string[]

  constructor(public ctx: VitestContext) {
    const mode = ctx.config.watch ? c.yellow(' DEV ') : c.cyan(' RUN ')
    console.log(`${c.inverse(c.bold(mode))} ${c.gray(this.ctx.config.root)}\n`)
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
      console.log(` ${getStateSymbol(task)} ${getFullName(task)}`)
      if (task.result.state === 'fail')
        console.log(c.red(`   ${F_RIGHT} ${(task.result.error as any)?.message}`))
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.end = performance.now()

    await this.stopListRender()

    console.log()

    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.error)
    const failedTests = tests.filter(i => i.result?.state === 'fail')

    if (failedSuites.length) {
      console.error(c.bold(c.red(`\nFailed to run ${failedSuites.length} suites:`)))
      for (const suite of failedSuites) {
        console.error(c.red(`\n- ${getFullName(suite)}`))
        await printError(suite.result?.error)
        console.log()
      }
    }

    if (failedTests.length) {
      console.error(c.bold(c.red(`\nFailed Tests (${failedTests.length})`)))
      for (const test of failedTests) {
        console.error(`${c.red(`\n${c.inverse(' FAIL ')}`)} ${getFullName(test)}`)
        await printError(test.result?.error)
        console.log()
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
      console.log(snapshotOutput.map((t, i) => i === 0
        ? `${padTitle('Snapshots')} ${t}`
        : `${padTitle('')} ${t}`,
      ).join('\n'))
      if (snapshotOutput.length > 1)
        console.log()
    }

    console.log(padTitle('Test Files'), getStateString(files))
    console.log(padTitle('Tests'), getStateString(tests))
    if (this.watchFilters)
      console.log(padTitle('Time'), time(threadTime))

    else
      console.log(padTitle('Time'), time(executionTime) + c.gray(` (in thread ${time(threadTime)}, ${(executionTime / threadTime * 100).toFixed(2)}%)`))

    console.log()
  }

  async onWatcherStart() {
    await this.stopListRender()

    const failed = getTests(this.ctx.state.getFiles()).filter(i => i.result?.state === 'fail')
    if (failed.length)
      console.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(` ${failed.length} tests failed. Watching for file changes...`)}`)
    else
      console.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Waiting for file changes...')}`)
  }

  async onWatcherRerun(files: string[], trigger: string) {
    await this.stopListRender()

    this.watchFilters = files

    console.clear()
    console.log(c.blue('Re-running tests...') + c.dim(` [ ${this.relative(trigger)} ]\n`))
  }

  async stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
