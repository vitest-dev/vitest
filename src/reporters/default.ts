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
    const tasks = files.reduce((acc, file) => acc.concat(file.collected.flatMap(([, tasks]) => tasks)), [] as Task[])
    const passed = tasks.filter(i => i.status === 'pass')
    const failed = tasks.filter(i => i.status === 'fail')
    const skipped = tasks.filter(i => i.status === 'skip')

    this.indent = 0

    this.log(`Passed   ${passed.length} / ${tasks.length}`)
    if (skipped.length)
      this.log(`Skipped   ${skipped.length}`)
    if (failed.length)
      this.log(`Failed   ${failed.length} / ${tasks.length}`)
    this.log(`Time     ${(this.end - this.start).toFixed(2)}ms`)
  }

  onSuiteBegin(suite: Suite) {
    if (suite.name) {
      this.indent += 1
      this.log(DOT + suite.name)
    }
  }

  onSuiteEnd(suite: Suite) {
    if (suite.name)
      this.indent -= 1
  }

  onFileBegin(file: File) {
    this.log(`- ${relative(process.cwd(), file.filepath)}`)
  }

  onFileEnd() {
    this.log()
  }

  onTaskBegin() {
    this.indent += 1
  }

  onTaskEnd(t: Task) {
    if (t.status === 'pass') {
      this.log(`${c.green(DOT + t.name)} ${c.inverse(c.green(' PASS '))}`)
    }
    else if (t.status === 'skip') {
      this.log(c.dim(c.yellow(`${DOT + t.name} (skipped)`)))
    }
    else if (t.status === 'todo') {
      this.log(c.dim(`${DOT + t.name} (todo)`))
    }
    else {
      this.error(`${c.red(DOT + t.name)} ${c.inverse(c.red(' FAIL '))}`)
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
