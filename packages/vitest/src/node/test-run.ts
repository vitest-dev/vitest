import type { TaskResultPack } from '@vitest/runner'
import type { ArgumentsType } from '../types/general'
import type { Vitest } from './core'
import type { Reporter } from './reporters'
import type { TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'

export class TestRun {
  private tests = emptyCounters()
  private suites = emptyCounters()

  constructor(private vitest: Vitest) {}

  async start(specifications: TestSpecification[]) {
    this.tests = emptyCounters()
    this.suites = emptyCounters()
    this.suites.total = specifications.length
    await this.report('onTestRunStart', specifications)
  }

  enqueued(module: TestModule) {
    // TODO
  }

  collected(modules: TestModule[]) {
    // TODO
  }

  updated(update: TaskResultPack[]) {
    // TODO
  }

  end() {
    // TODO
  }

  private report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    return this.vitest.report(name, ...args)
  }
}

interface Counter {
  total: number
  completed: number
  passed: number
  failed: number
  skipped: number
  todo: number
}

function emptyCounters(): Counter {
  return { completed: 0, passed: 0, failed: 0, skipped: 0, todo: 0, total: 0 }
}
