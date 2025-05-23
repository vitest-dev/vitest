import type { Task } from '@vitest/runner'
import type { TestCase, TestModule, TestSuite } from './reported-tasks'
import { getFullName } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { DefaultReporter } from './default'
import { F_RIGHT } from './renderers/figures'
import { formatProjectName, getStateSymbol } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  protected verbose = true
  renderSucceed = true

  printTestModule(module: TestModule): void {
    // still print the test module in TTY,
    // but don't print it in the CLI because we
    // print all the tests when they finish
    // instead of printing them when the test file finishes
    if (this.isTTY) {
      return super.printTestModule(module)
    }
  }

  onTestCaseResult(test: TestCase): void {
    super.onTestCaseResult(test)

    // don't print tests in TTY as they go, only print them
    // in the CLI when they finish
    if (this.isTTY) {
      return
    }

    const testResult = test.result()

    if (this.ctx.config.hideSkippedTests && testResult.state === 'skipped') {
      return
    }

    let title = ` ${getStateSymbol(test.task)} `

    if (test.project.name) {
      title += formatProjectName(test.project)
    }

    title += getFullName(test.task, c.dim(' > '))
    title += this.getDurationPrefix(test.task)

    const diagnostic = test.diagnostic()
    if (diagnostic?.heap != null) {
      title += c.magenta(` ${Math.floor(diagnostic.heap / 1024 / 1024)} MB heap used`)
    }

    if (testResult.state === 'skipped' && testResult.note) {
      title += c.dim(c.gray(` [${testResult.note}]`))
    }

    this.log(title)

    if (testResult.state === 'failed') {
      testResult.errors.forEach(error => this.log(c.red(`   ${F_RIGHT} ${error?.message}`)))
    }

    if (test.annotations().length) {
      this.log()
      this.printAnnotations(test, 'log', 3)
      this.log()
    }
  }

  protected printTestSuite(testSuite: TestSuite): void {
    const indentation = '  '.repeat(getIndentation(testSuite.task))
    const tests = Array.from(testSuite.children.allTests())
    const state = getStateSymbol(testSuite.task)

    this.log(` ${indentation}${state} ${testSuite.name} ${c.dim(`(${tests.length})`)}`)
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
