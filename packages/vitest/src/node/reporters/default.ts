import type { Vitest } from '../core'
import type { TestSpecification } from '../spec'
import type { BaseOptions } from './base'
import type { ReportedHookContext, TestCase, TestModule } from './reported-tasks'
import { BaseReporter } from './base'
import { SummaryReporter } from './summary'

export interface DefaultReporterOptions extends BaseOptions {
  summary?: boolean
}

export class DefaultReporter extends BaseReporter {
  private options: DefaultReporterOptions
  private summary?: SummaryReporter

  constructor(options: DefaultReporterOptions = {}) {
    super(options)
    this.options = {
      summary: true,
      ...options,
    }

    if (!this.isTTY) {
      this.options.summary = false
    }

    if (this.options.summary) {
      this.summary = new SummaryReporter()
    }
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    this.summary?.onTestRunStart(specifications)
  }

  onTestModuleQueued(file: TestModule): void {
    this.summary?.onTestModuleQueued(file)
  }

  onTestModuleCollected(module: TestModule): void {
    this.summary?.onTestModuleCollected(module)
  }

  onTestModuleEnd(module: TestModule): void {
    this.summary?.onTestModuleEnd(module)
  }

  onTestCaseReady(test: TestCase): void {
    this.summary?.onTestCaseReady(test)
  }

  onTestCaseResult(test: TestCase): void {
    this.summary?.onTestCaseResult(test)
  }

  onHookStart(hook: ReportedHookContext): void {
    this.summary?.onHookStart(hook)
  }

  onHookEnd(hook: ReportedHookContext): void {
    this.summary?.onHookEnd(hook)
  }

  onInit(ctx: Vitest): void {
    super.onInit(ctx)
    this.summary?.onInit(ctx, { verbose: this.verbose })
  }

  onPathsCollected(paths: string[] = []): void {
    if (this.isTTY) {
      if (this.renderSucceed === undefined) {
        this.renderSucceed = !!this.renderSucceed
      }

      if (this.renderSucceed !== true) {
        this.renderSucceed = paths.length <= 1
      }
    }
  }

  onTestRunEnd(): void {
    this.summary?.onTestRunEnd()
  }
}
