import type { File } from '@vitest/runner'
import type { Vitest } from '../core'
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

  onTestModuleQueued(file: TestModule) {
    this.summary?.onTestModuleQueued(file)
  }

  onTestModuleCollected(module: TestModule) {
    this.summary?.onTestModuleCollected(module)
  }

  onTestModuleEnd(module: TestModule) {
    this.summary?.onTestModuleEnd(module)
  }

  onTestCaseStart(test: TestCase) {
    this.summary?.onTestCaseStart(test)
  }

  onTestCaseEnd(test: TestCase) {
    this.summary?.onTestCaseEnd(test)
  }

  onHookStart(hook: ReportedHookContext) {
    this.summary?.onHookStart(hook)
  }

  onHookEnd(hook: ReportedHookContext) {
    this.summary?.onHookEnd(hook)
  }

  onInit(ctx: Vitest) {
    super.onInit(ctx)
    this.summary?.onInit(ctx, { verbose: this.verbose })
  }

  onPathsCollected(paths: string[] = []) {
    if (this.isTTY) {
      if (this.renderSucceed === undefined) {
        this.renderSucceed = !!this.renderSucceed
      }

      if (this.renderSucceed !== true) {
        this.renderSucceed = paths.length <= 1
      }
    }

    this.summary?.onPathsCollected(paths)
  }

  onWatcherRerun(files: string[], trigger?: string) {
    this.summary?.onWatcherRerun()
    super.onWatcherRerun(files, trigger)
  }

  onFinished(files?: File[], errors?: unknown[]) {
    this.summary?.onFinished()
    super.onFinished(files, errors)
  }
}
