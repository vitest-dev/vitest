import type { Task } from '@vitest/runner'
import type { UserConsoleLog } from '../../types/general'
import type { TestSpecification } from '../test-specification'
import type { DefaultReporterOptions } from './default'
import type { TestCase, TestModule, TestModuleState, TestResult } from './reported-tasks'
import { DefaultReporter } from './default'

export class AgentReporter extends DefaultReporter {
  renderSucceed = false

  constructor(options: DefaultReporterOptions = {}) {
    super({ ...options, summary: false })
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    super.onTestRunStart(specifications)
    this.renderSucceed = false
  }

  protected logFailedTask(task: Task): void {
    for (const log of task.logs || []) {
      this.onUserConsoleLog(log, 'failed')
    }
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

  shouldLog(log: UserConsoleLog, taskState?: TestResult['state']): boolean {
    if (taskState !== 'failed') {
      return false
    }
    return super.shouldLog(log, taskState)
  }
}
