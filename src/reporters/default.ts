/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import Listr from 'listr'
import { File, Reporter, RunnerContext, Task, ResolvedConfig } from '../types'
import { printError } from './error'

const CROSS = '✖ '

interface TaskPromise {
  promise: Promise<void>
  resolve: () => void
  reject: (e: unknown) => void
}

export class DefaultReporter implements Reporter {
  start = 0
  end = 0

  listr: Listr | null = null
  listrPromise: Promise<void> | null = null
  taskMap: Map<Task, TaskPromise> = new Map()
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
    this.taskMap = new Map()

    const tasks = files.reduce((acc, file) => acc.concat(file.suites.flatMap(i => i.tasks)), [] as Task[])

    tasks.forEach((t) => {
      const obj = {} as TaskPromise
      obj.promise = new Promise<void>((resolve, reject) => {
        obj.resolve = resolve
        obj.reject = reject
      })
      this.taskMap.set(t, obj)
    })

    const createTasksListr = (tasks: Task[]): Listr.ListrTask[] => {
      return tasks.map((task) => {
        return {
          title: task.name,
          skip: () => task.mode === 'skip',
          task: async() => {
            return await this.taskMap.get(task)?.promise
          },
        }
      })
    }

    const listrOptions: Listr.ListrOptions = {
      exitOnError: false,
    }

    this.listr = new Listr(files.map((file) => {
      return {
        title: this.relative(file.filepath),
        task: () => {
          if (file.error)
            throw file.error
          const suites = file.suites.filter(i => i.tasks.length)
          if (!suites.length)
            throw new Error('No tasks found')
          return new Listr(suites.flatMap((suite) => {
            if (!suite.name)
              return createTasksListr(suite.tasks)

            return [{
              title: suite.name,
              skip: () => suite.mode !== 'run',
              task: () => new Listr(createTasksListr(suite.tasks), listrOptions),
            }]
          }), listrOptions)
        },
      }
    }), listrOptions)

    this.listrPromise = this.listr.run().catch(() => {})
  }

  onTaskEnd(task: Task) {
    if (task.state === 'fail')
      this.taskMap.get(task)?.reject(task.error)
    else
      this.taskMap.get(task)?.resolve()
  }

  async onFinished(ctx: RunnerContext) {
    await this.listrPromise

    this.end = performance.now()

    console.log()
    const { tasks, suites, files } = ctx
    const failedFiles = files.filter(i => i.error)
    const failedSuites = suites.filter(i => i.error)
    const runnable = tasks.filter(i => i.state === 'pass' || i.state === 'fail')
    const passed = tasks.filter(i => i.state === 'pass')
    const failed = tasks.filter(i => i.state === 'fail')
    const skipped = tasks.filter(i => i.state === 'skip')
    const todo = tasks.filter(i => i.state === 'todo')

    if (failedFiles.length) {
      console.error(c.red(c.bold(`\nFailed to parse ${failedFiles.length} files:`)))
      for (const file of failedFiles)
        console.error(c.red(`- ${file.filepath}`))
      console.log()

      for (const file of failedFiles) {
        await printError(file.error)
        console.log()
      }
    }

    if (failedSuites.length) {
      console.error(c.bold(c.red(`\nFailed to run ${failedSuites.length} suites:`)))
      for (const suite of failedSuites) {
        console.error(c.red(`\n- ${suite.file?.filepath} > ${suite.name}`))
        await printError(suite.error)
        console.log()
      }
    }

    if (failed.length) {
      console.error(c.bold(c.red(`\nFailed Tests (${failed.length})`)))
      for (const task of failed) {
        console.error(`${c.red(`\n${CROSS + c.inverse(' FAIL ')}`)} ${[task.suite.name, task.name].filter(Boolean).join(' > ')}`)
        await printError(task.error)
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

    const failed = ctx.tasks.filter(i => i.state === 'fail')
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

  // TODO:
  onSnapshotUpdate() {
  }
}
