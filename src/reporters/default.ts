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
  indent = 0
  start = 0
  end = 0

  listr: Listr | null = null
  listrPromise: Promise<void> | null = null
  taskMap: Map<Task, TaskPromise> = new Map()

  onStart() {
    this.indent = 0
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

    this.log()
    const { tasks, suites, files } = ctx
    const failedFiles = files.filter(i => i.error)
    const failedSuites = suites.filter(i => i.error)
    const runable = tasks.filter(i => i.state === 'pass' || i.state === 'fail')
    const passed = tasks.filter(i => i.state === 'pass')
    const failed = tasks.filter(i => i.state === 'fail')
    const skipped = tasks.filter(i => i.state === 'skip')
    const todo = tasks.filter(i => i.state === 'todo')

    this.indent = 0

    if (failedFiles.length) {
      this.error(c.bold(`\nFailed to parse ${failedFiles.length} files:`))
      failedFiles.forEach((i) => {
        this.error(`\n- ${i.filepath}`)
        console.error(i.error || 'Unknown error')
        this.log()
      })
    }

    if (failedSuites.length) {
      this.error(c.bold(`\nFailed to run ${failedSuites.length} suites:`))
      failedSuites.forEach((i) => {
        this.error(`\n- ${i.file?.filepath} > ${i.name}`)
        console.error(i.error || 'Unknown error')
        this.log()
      })
    }

    if (failed.length) {
      this.error(c.bold(`\nFailed Tests (${failed.length})`))
      failed.forEach((task) => {
        this.error(`\n${CROSS + c.inverse(c.red(' FAIL '))} ${[task.suite.name, task.name].filter(Boolean).join(' > ')} ${c.gray(c.dim(`${task.file?.filepath}`))}`)
        console.error(task.error || 'Unknown error')
        this.log()
      })
    }

    this.log(c.bold(c.green(`Passed   ${passed.length} / ${runable.length}`)))
    if (failed.length)
      this.log(c.bold(c.red(`Failed   ${failed.length} / ${runable.length}`)))
    if (skipped.length)
      this.log(c.yellow(`Skipped  ${skipped.length}`))
    if (todo.length)
      this.log(c.dim(`Todo     ${todo.length}`))
    this.log(`Time     ${(this.end - this.start).toFixed(2)}ms`)
  }

  private getIndent(offest = 0) {
    return ' '.repeat((this.indent + offest) * 2)
  }

  private log(msg = '', indentOffset = 0) {
    // eslint-disable-next-line no-console
    console.log(`${this.getIndent(indentOffset)}${msg}`)
  }

  private error(msg = '', indentOffset = 0) {
    // eslint-disable-next-line no-console
    console.error(c.red(`${this.getIndent(indentOffset)}${msg}`))
  }

  onSnapshotUpdate() {
  }
}
