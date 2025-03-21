import type { Task } from '@vitest/runner'
import { getFullName, getTests } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { DefaultReporter } from './default'
import { F_RIGHT } from './renderers/figures'
import { formatProjectName, getStateSymbol } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  protected verbose = true
  renderSucceed = true

  printTask(task: Task): void {
    if (this.isTTY) {
      return super.printTask(task)
    }

    if (task.type !== 'test' || !task.result?.state || task.result?.state === 'run' || task.result?.state === 'queued') {
      return
    }

    let title = ` ${getStateSymbol(task)} `

    if (task.file.projectName) {
      title += formatProjectName(task.file.projectName)
    }

    title += getFullName(task, c.dim(' > '))
    title += super.getDurationPrefix(task)

    if (this.ctx.config.logHeapUsage && task.result.heap != null) {
      title += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)
    }

    if (task.result?.note) {
      title += c.dim(c.gray(` [${task.result.note}]`))
    }

    this.ctx.logger.log(title)

    if (task.result.state === 'fail') {
      task.result.errors?.forEach(error => this.log(c.red(`   ${F_RIGHT} ${error?.message}`)))
    }
  }

  protected printSuite(task: Task): void {
    const indentation = '  '.repeat(getIndentation(task))
    const tests = getTests(task)
    const state = getStateSymbol(task)

    this.log(` ${indentation}${state} ${task.name} ${c.dim(`(${tests.length})`)}`)
  }

  protected getTestName(test: Task): string {
    return test.name
  }

  protected getTestIndentation(test: Task): string {
    return '  '.repeat(getIndentation(test))
  }

  protected formatShortError(): string {
    // Short errors are not shown in tree-view
    return ''
  }
}

function getIndentation(suite: Task, level = 1): number {
  if (suite.suite && !('filepath' in suite.suite)) {
    return getIndentation(suite.suite, level + 1)
  }

  return level
}
