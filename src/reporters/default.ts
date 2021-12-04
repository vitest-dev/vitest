import { relative } from 'path'
import { performance } from 'perf_hooks'
import c from 'picocolors'
import { File, Reporter, RunnerContext, Suite, Task } from '../types'

const DOT = '· '

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

  onFinished({ files }: RunnerContext) {
    this.end = performance.now()
    const tasks = files.reduce((acc, file) => acc.concat(file.suites.flatMap(i => i.tasks)), [] as Task[])
    const passed = tasks.filter(i => i.status === 'pass')
    const failed = tasks.filter(i => i.status === 'fail')
    const skipped = tasks.filter(i => i.status === 'skip')
    const todo = tasks.filter(i => i.status === 'todo')

    this.indent = 0

    this.log(c.green(`Passed   ${passed.length} / ${tasks.length}`))
    if (skipped.length)
      this.log(c.yellow(`Skipped  ${skipped.length}`))
    if (todo.length)
      this.log(c.dim(`Todo     ${todo.length}`))
    if (failed.length)
      this.log(c.red(`Failed   ${failed.length} / ${tasks.length}`))
    this.log(`Time     ${(this.end - this.start).toFixed(2)}ms`)
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

  onTaskBegin() {
    this.indent += 1
  }

  onTaskEnd(t: Task) {
    if (t.status === 'pass') {
      this.log(`${c.green(`✔ ${t.name}`)}`)
    }
    else if (t.status === 'skip') {
      this.log(c.dim(c.yellow(`${DOT + t.name} (skipped)`)))
    }
    else if (t.status === 'todo') {
      this.log(c.dim(`${DOT + t.name} (todo)`))
    }
    else {
      this.error(`${c.red(`⤫ ${c.inverse(c.red(' FAIL '))} ${t.name}`)}`)
      this.error(String(t.error), 1)
      process.exitCode = 1
    }
    this.indent -= 1
  }

  log(msg = '', indentDelta = 0) {
    // eslint-disable-next-line no-console
    console.log(`${' '.repeat((this.indent + indentDelta) * 2)}${msg}`)
  }

  error(msg = '', indentDelta = 0) {
    // eslint-disable-next-line no-console
    console.error(c.red(`${' '.repeat((this.indent + indentDelta) * 2)}${msg}`))
  }

  onSnapshotUpdate() {
  }
}
