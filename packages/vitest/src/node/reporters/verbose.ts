import type { TestCase, TestModule } from './reported-tasks'
import { getFullName } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { DefaultReporter } from './default'
import { F_RIGHT } from './renderers/figures'
import { formatProjectName } from './renderers/utils'

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

    let title = ` ${this.getStateSymbol(test)} `

    if (test.project.name) {
      title += formatProjectName(test.project)
    }

    title += getFullName(test.task, c.dim(' > '))
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
