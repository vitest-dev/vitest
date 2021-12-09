/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import { File, Reporter, RunnerContext, ResolvedConfig } from '../types'
import { getSuites, getTests } from '../utils'
import { printError } from './error'
import { createRenderer } from './renderer'

export class DefaultReporter implements Reporter {
  start = 0
  end = 0
  renderer: ReturnType<typeof createRenderer> = undefined!

  constructor(public config: ResolvedConfig) {}

  relative(path: string) {
    return relative(this.config.root, path)
  }

  onStart() {
    console.log(c.green(`Running tests under ${c.gray(this.config.root)}\n`))
  }

  onCollected(files: File[]) {
    this.start = performance.now()
    this.renderer?.stop()
    this.renderer = createRenderer(files).start()
  }

  async onFinished(ctx: RunnerContext, files = ctx.files) {
    this.renderer?.stop()

    this.end = performance.now()

    console.log()

    const snapshot = ctx.snapshotManager.report()
    if (snapshot)
      console.log(snapshot.join('\n'))

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

    console.log(c.bold(c.green(`Passed   ${passed.length} / ${runnable.length}`)))
    if (failed.length)
      console.log(c.bold(c.red(`Failed   ${failed.length} / ${runnable.length}`)))
    if (skipped.length)
      console.log(c.yellow(`Skipped  ${skipped.length}`))
    if (todo.length)
      console.log(c.dim(`Todo     ${todo.length}`))
    console.log(`Time     ${(this.end - this.start).toFixed(2)}ms`)
  }

  async onWatcherStart(ctx: RunnerContext) {
    // await this.listrPromise
    this.renderer?.stop()

    const failed = ctx.tests.filter(i => i.result?.state === 'fail')
    if (failed.length)
      console.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(` ${failed.length} tests failed. Watching for file changes...`)}`)
    else
      console.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Watching for file changes...')}`)
  }

  async onWatcherRerun(files: string[], trigger: string) {
    this.renderer?.stop()

    console.clear()
    console.log(c.blue('Re-running tests...') + c.dim(` [ ${this.relative(trigger)} ]\n`))
  }
}
