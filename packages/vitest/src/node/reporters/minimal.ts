import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'
import type { DefaultReporterOptions } from './default'
import type { TestCase, TestModule, TestModuleState } from './reported-tasks'
import { DefaultReporter } from './default'

export class MinimalReporter extends DefaultReporter {
  renderSucceed = false

  constructor(options: DefaultReporterOptions = {}) {
    super({ ...options, summary: false })
  }

  onInit(ctx: Vitest): void {
    if (this.silent == null && !ctx.config.providedOptions.silent) {
      this.silent = 'passed-only'
    }
    super.onInit(ctx)
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    super.onTestRunStart(specifications)
    this.renderSucceed = false
  }

  protected printTestModule(testModule: TestModule): void {
    if (testModule.state() !== 'failed') {
      return
    }
    super.printTestModule(testModule)
  }

  protected printTestCase(moduleState: TestModuleState, test: TestCase): void {
    const testResult = test.result()
    if (testResult.state === 'failed') {
      super.printTestCase(moduleState, test)
    }
  }
}
