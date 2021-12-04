import { relative } from 'path'
import { performance } from 'perf_hooks'
import c from 'picocolors'
import ora from 'ora'
import { File, Reporter, RunnerContext, Suite, Task } from '../types'

const DOT = '· '
const CHECK = '✔ '
const CROSS = '⤫ '

export class DefaultReporter implements Reporter {
  indent = 0
  start = 0
  end = 0

  onStart() {
    this.indent = 0
  }

  onCollected() {
    this.start = performance.now()
  }

  onSuiteBegin(suite: Suite) {
    if (suite.name) {
      this.indent += 1
      const name = DOT + suite.name
      if (suite.mode === 'skip')
        this.log(c.dim(c.yellow(`${name} (skipped)`)))
      else if (suite.mode === 'todo')
        this.log(c.dim(`${name} (todo)`))
      else
        this.log(name)
    }
  }

  onSuiteEnd(suite: Suite) {
    if (suite.name)
      this.indent -= 1
  }

  onFileBegin(file: File) {
    this.log(`- ${relative(process.cwd(), file.filepath)} ${c.dim(`(${file.suites.flatMap(i => i.tasks).length} tests)`)}`)
  }

  onFileEnd() {
    this.log()
  }

  onTaskBegin(task: Task) {
    this.indent += 1
    // @ts-expect-error
    task.__ora = ora({ text: task.name, prefixText: this.getIndent().slice(1), spinner: 'arc' }).start()
  }

  onTaskEnd(task: Task) {
    // @ts-expect-error
    task.__ora?.stop()

    if (task.state === 'pass') {
      this.log(`${c.green(CHECK + task.name)}`)
    }
    else if (task.state === 'skip') {
      this.log(c.dim(c.yellow(`${DOT + task.name} (skipped)`)))
    }
    else if (task.state === 'todo') {
      this.log(c.dim(`${DOT + task.name} (todo)`))
    }
    else {
      this.error(`${c.red(`${CROSS}${task.name}`)}`)
      process.exitCode = 1
    }
    this.indent -= 1
  }

  onFinished({ files }: RunnerContext) {
    this.end = performance.now()
    const failedFiles = files.filter(i => i.error)
    const tasks = files.reduce((acc, file) => acc.concat(file.suites.flatMap(i => i.tasks)), [] as Task[])
    const runnable = tasks.filter(i => i.state === 'pass' || i.state === 'fail')
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

    if (failed.length) {
      this.error(c.bold(`\nFailed Tests (${failed.length})`))
      failed.forEach((task) => {
        this.error(`\n${CROSS + c.inverse(c.red(' FAIL '))} ${[task.suite.name, task.name].filter(Boolean).join(' > ')} ${c.gray(`${task.file?.filepath}`)}`)
        console.error(task.error || 'Unknown error')
        this.log()
      })
    }

    this.log(c.green(`Passed   ${passed.length} / ${runnable.length}`))
    if (failed.length)
      this.log(c.red(`Failed   ${failed.length} / ${runnable.length}`))
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
