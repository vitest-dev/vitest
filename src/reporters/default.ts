/* eslint-disable no-console */
import { performance } from 'perf_hooks'
import { relative } from 'path'
import c from 'picocolors'
import Listr from 'listr'
import { File, Reporter, RunnerContext, Task } from '../types'

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
        title: relative(process.cwd(), file.filepath),
        task: () => {
          return new Listr(file.suites.flatMap((suite) => {
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
      console.error(c.bold(`\nFailed to parse ${failedFiles.length} files:`))
      failedFiles.forEach((i) => {
        console.error(c.red(`\n- ${i.filepath}`))
        console.error(i.error || 'Unknown error')
        console.log()
      })
    }

    if (failedSuites.length) {
      console.error(c.bold(`\nFailed to run ${failedSuites.length} suites:`))
      failedSuites.forEach((i) => {
        console.error(c.red(`\n- ${i.file?.filepath} > ${i.name}`))
        console.error(i.error || 'Unknown error')
        console.log()
      })
    }

    if (failed.length) {
      console.error(c.bold(`\nFailed Tests (${failed.length})`))
      failed.forEach((task) => {
        console.error(`\n${CROSS + c.inverse(c.red(' FAIL '))} ${[task.suite.name, task.name].filter(Boolean).join(' > ')} ${c.gray(c.dim(`${task.file?.filepath}`))}`)
        console.error(task.error || 'Unknown error')
        console.log()
      })
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

    const failed = ctx.tasks.some(i => i.state === 'fail')
    if (failed)
      console.log(c.red('\nTests failed. Watching for file changes...'))
    else
      console.log(c.green('\nWatching for file changes...'))
  }

  async onWatcherRerun(files: string[], trigger: string) {
    await this.listrPromise

    console.log(c.blue(`File ${relative(process.cwd(), trigger)} changed, re-running tests...`))
  }

  // TODO:
  onSnapshotUpdate() {
  }
}
