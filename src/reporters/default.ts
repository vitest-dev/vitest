/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import Listr from 'listr'
import { File, Suite, Reporter, RunnerContext, Test, ResolvedConfig } from '../types'
import { getSuites, getTests, hasTests } from '../utils'
import { printError } from './error'

interface TestPromise {
  promise: Promise<void>
  resolve: () => void
  reject: (e: unknown) => void
}

export class DefaultReporter implements Reporter {
  start = 0
  end = 0

  listr: Listr | null = null
  listrPromise: Promise<void> | null = null
  testMap: Map<Test, TestPromise> = new Map()
  cwd = process.cwd()

  relative(path: string) {
    return relative(this.cwd, path)
  }

  onStart(config: ResolvedConfig) {
    this.cwd = config.root
    console.log(c.green(`Running tests under ${c.gray(this.cwd)}\n`))
  }

  onCollected(files: File[]) {
    this.start = performance.now()
    this.testMap = new Map()

    const tests = files.reduce((acc, file) => acc.concat(getTests(file)), [] as Test[])

    tests.forEach((t) => {
      const obj = {} as TestPromise
      obj.promise = new Promise<void>((resolve, reject) => {
        obj.resolve = resolve
        obj.reject = reject
      })
      this.testMap.set(t, obj)
    })

    const listrOptions: Listr.ListrOptions = {
      exitOnError: false,
    }

    const createListrTestTask = (test: Test): Listr.ListrTask => {
      return {
        title: test.name,
        skip: () => test.mode === 'skip' || test.mode === 'todo',
        task: async() => {
          return await this.testMap.get(test)?.promise
        },
      }
    }

    function createListrSuiteTask(suite: Suite): Listr.ListrContext {
      return {
        title: suite.name,
        skip: () => suite.mode !== 'run',
        task: () => createSuiteListr(suite),
      }
    }

    function createListrSuiteChildren(suite: Suite): Listr.ListrTask[] {
      return suite.children.map(c => c.type === 'test' ? createListrTestTask(c) : createListrSuiteTask(c))
    }

    function createSuiteListr(suite: Suite): Listr {
      if (suite.result?.error)
        throw suite.result.error
      if (!hasTests(suite))
        throw new Error('No tests found')
      return new Listr(createListrSuiteChildren(suite), listrOptions)
    }

    this.listr = new Listr(files.map((file) => {
      return {
        title: this.relative(file.filepath),
        task: () => {
          if (file.result?.error)
            throw file.result?.error

          return createSuiteListr(file)
        },
      }
    }), listrOptions)

    this.listrPromise = this.listr.run().catch(() => { })
  }

  onTestEnd(test: Test) {
    if (test.result?.state === 'fail')
      this.testMap.get(test)?.reject(test.result?.error)
    else
      this.testMap.get(test)?.resolve()
  }

  async onFinished(ctx: RunnerContext, files = ctx.files) {
    await this.listrPromise

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
    await this.listrPromise

    const failed = ctx.tests.filter(i => i.result?.state === 'fail')
    if (failed.length)
      console.log(`\n${c.bold(c.inverse(c.red(' FAIL ')))}${c.red(` ${failed.length} tests failed. Watching for file changes...`)}`)
    else
      console.log(`\n${c.bold(c.inverse(c.green(' PASS ')))}${c.green(' Watching for file changes...')}`)
  }

  async onWatcherRerun(files: string[], trigger: string) {
    await this.listrPromise

    console.clear()
    console.log(c.blue('Re-running tests...') + c.dim(` [ ${this.relative(trigger)} ]\n`))
  }
}
