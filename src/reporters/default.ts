/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import { Reporter, VitestContext } from '../types'
import { getSuites, getTests } from '../utils'
import { getSnapshotSummaryOutput } from '../integrations/snapshot/utils/jest-reporters-lite'
import { printError } from './error'
import { createRenderer } from './renderer'

export class DefaultReporter implements Reporter {
  start = 0
  end = 0
  renderer?: ReturnType<typeof createRenderer>
  filters?: string[]

  constructor(public ctx: VitestContext) {
    console.log(c.green(`Running tests under ${c.gray(this.ctx.config.root)}\n`))
    this.start = performance.now()
  }

  relative(path: string) {
    return relative(this.ctx.config.root, path)
  }

  onStart(onlyFiles = this.filters) {
    const files = this.ctx.state.getFiles(onlyFiles)
    if (!this.renderer)
      this.renderer = createRenderer(files).start()
    else
      this.renderer.update(files)
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.end = performance.now()

    await this.stopListRender()

    console.log()

    const suites = getSuites(files)
    const tests = getTests(files)

    const failedSuites = suites.filter(i => i.result?.error)

    const runnable = tests.filter(i => i.result?.state === 'pass' || i.result?.state === 'fail')
    const passed = tests.filter(i => i.result?.state === 'pass')
    const failed = tests.filter(i => i.result?.state === 'fail')
    const skipped = tests.filter(i => i.mode === 'skip')
    const todo = tests.filter(i => i.mode === 'todo')

    if (failedSuites.length) {
      console.error(c.bold(c.red(`\nFailed to run ${failedSuites.length} suites:`)))
      for (const suite of failedSuites) {
        console.error(c.red(`\n- ${suite.file?.filepath} > ${suite.name}`))
        await printError(suite.result?.error)
        console.log()
      }
    }

    if (failed.length) {
      console.error(c.bold(c.red(`\nFailed Tests (${failed.length})`)))
      for (const test of failed) {
        console.error(`${c.red(`\n${c.inverse(' FAIL ')}`)} ${[test.suite.name, test.name].filter(Boolean).join(' > ')}`)
        await printError(test.result?.error)
        console.log()
      }
    }

    const snapshotOutput = getSnapshotSummaryOutput(this.ctx.config.root, this.ctx.snapshot.summary)
    if (snapshotOutput.length)
      console.log(snapshotOutput.join('\n'))

    console.log(c.bold(c.green(`Passed   ${passed.length} / ${runnable.length}`)))
    if (failed.length)
      console.log(c.bold(c.red(`Failed   ${failed.length} / ${runnable.length}`)))
    if (skipped.length)
      console.log(c.yellow(`Skipped  ${skipped.length}`))
    if (todo.length)
      console.log(c.dim(`Todo     ${todo.length}`))
    console.log(`Time     ${(this.end - this.start).toFixed(2)}ms`)
  }

  async onWatcherStart() {
    await this.stopListRender()

    const failed = getTests(this.ctx.state.getFiles()).filter(i => i.result?.state === 'fail')
    if (failed.length)
      console.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(` ${failed.length} tests failed. Watching for file changes...`)}`)
    else
      console.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Watching for file changes...')}`)
  }

  async onWatcherRerun(files: string[], trigger: string) {
    await this.stopListRender()

    this.filters = files

    console.clear()
    console.log(c.blue('Re-running tests...') + c.dim(` [ ${this.relative(trigger)} ]\n`))
  }

  async stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
