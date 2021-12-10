/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import { Reporter, Task, VitestContext } from '../types'
import { getSuites, getTests } from '../utils'
import { printError } from './error'
import { createRenderer, renderSnapshotSummary } from './renderer'

export class DefaultReporter implements Reporter {
  start = 0
  end = 0
  renderer?: ReturnType<typeof createRenderer>
  filters?: string[]

  constructor(public ctx: VitestContext) {
    console.log(c.green(`Running tests at ${c.gray(this.ctx.config.root)}\n`))
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
    const failedTests = tests.filter(i => i.result?.state === 'fail')
    const isFailed = failedSuites.length || failedTests.length
    const color = isFailed ? c.red : c.green

    if (failedSuites.length) {
      console.error(c.bold(c.red(`\nFailed to run ${failedSuites.length} suites:`)))
      for (const suite of failedSuites) {
        console.error(c.red(`\n- ${suite.file?.filepath} > ${suite.name}`))
        await printError(suite.result?.error)
        console.log()
      }
    }

    if (failedTests.length) {
      console.error(c.bold(c.red(`\nFailed Tests (${failedTests.length})`)))
      for (const test of failedTests) {
        console.error(`${c.red(`\n${c.inverse(' FAIL ')}`)} ${[test.suite.name, test.name].filter(Boolean).join(' > ')}`)
        await printError(test.result?.error)
        console.log()
      }
    }

    const executionTime = this.end - this.start
    const threadTime = tests.reduce((acc, test) => acc + (test.result?.end ? test.result.end - test.result.start : 0), 0)

    const pad = (str: string) => str.padEnd(13)
    const time = (time: number) => Math.round(time) + c.dim('ms')

    const snapshotOutput = renderSnapshotSummary(this.ctx.config.root, this.ctx.snapshot.summary)
    if (snapshotOutput.length) {
      console.log(snapshotOutput.map((t, i) => i === 0
        ? `${pad('Snapshots')} ${t}`
        : `${pad('')} ${t}`,
      ).join('\n'))
      console.log()
    }

    console.log(c.bold(color(pad('Test Files'))), getStateString(files))
    console.log(c.bold(color(pad('Tests'))), getStateString(tests))
    if (this.filters) {
      console.log(pad('Time'), time(threadTime))
    }
    else {
      console.log(pad('Thread Time'), time(threadTime))
      console.log(pad('Time'), time(executionTime) + c.gray(` (${(executionTime / threadTime * 100).toFixed(2)}%)`))
    }
    console.log()
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

function getStateString(tasks: Task[], name = 'tests') {
  if (tasks.length === 0)
    return c.dim(`no ${name}`)

  const passed = tasks.filter(i => i.result?.state === 'pass')
  const failed = tasks.filter(i => i.result?.state === 'fail')
  const skipped = tasks.filter(i => i.mode === 'skip')
  const todo = tasks.filter(i => i.mode === 'todo')

  return [
    failed.length ? c.bold(c.red(`${failed.length} failed`)) : null,
    passed.length ? c.bold(c.green(`${passed.length} passed`)) : null,
    skipped.length ? c.yellow(`${skipped.length} skipped`) : null,
    todo.length ? c.gray(`${todo.length} todo`) : null,
  ].filter(Boolean).join(c.dim(' | ')) + c.gray(` (${tasks.length})`)
}
