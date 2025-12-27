import type { TestCase, TestModule } from './reported-tasks'
import { getTestName } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { DefaultReporter } from './default'
import { F_RIGHT } from './renderers/figures'
import { separator } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  protected verbose = true
  renderSucceed = true

  printTestModule(_module: TestModule): void {
    // don't print test module, only print tests
  }

  onTestCaseResult(test: TestCase): void {
    super.onTestCaseResult(test)

    const testResult = test.result()

    if (this.ctx.config.hideSkippedTests && testResult.state === 'skipped') {
      return
    }

    let title = ` ${this.getEntityPrefix(test)} `

    title += test.module.task.name
    if (test.location) {
      title += c.dim(`:${test.location.line}:${test.location.column}`)
    }
    title += separator

    title += getTestName(test.task, separator)
    title += this.getTestCaseSuffix(test)

    this.log(title)

    if (testResult.state === 'failed') {
      testResult.errors.forEach(error => this.log(c.red(`   ${F_RIGHT} ${error.message}`)))
    }

    if (test.annotations().length) {
      this.log()
      this.printAnnotations(test, 'log', 3)
      this.log()
    }
  }
}
