import type { TaskResultPack } from '@vitest/runner'
import type { Vitest } from './core'
import type { TestCase, TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'

export class TestRun {
  private tests = emptyCounters()
  private suites = emptyCounters()

  // Internal state to prevent reporting duplicates and guaranteeing correct order
  private queuedTestModules = new Set<TestModule['id']>()
  private runningTestModules = new Set<TestModule['id']>()
  private finishedTestModules = new Set<TestModule['id']>()

  private runningTestCases = new Set<TestCase['id']>()
  private finishedTestCases = new Set<TestCase['id']>()

  constructor(private vitest: Vitest) {}

  async start(specifications: TestSpecification[]) {
    this.tests = emptyCounters()
    this.suites = emptyCounters()
    this.suites.total = specifications.length

    this.queuedTestModules.clear()
    this.runningTestModules.clear()
    this.finishedTestModules.clear()
    this.runningTestCases.clear()
    this.finishedTestCases.clear()

    await this.vitest.report('onTestRunStart', specifications)
  }

  enqueued(_module: TestModule) {
    // TODO
  }

  collected(_modules: TestModule[]) {
    // TODO
  }

  async updated(update: TaskResultPack[]) {
    const queuedTestModules: TestModule[] = []
    const runningTestModules: TestModule[] = []
    const finishedTestModules: TestModule[] = []

    const runningTestCases: TestCase[] = []
    const finishedTestCases: TestCase[] = []

    for (const [id] of update) {
      const entity = this.vitest.state.getReportedEntity(this.vitest.state.idMap.get(id))

      if (!entity) {
        continue
      }

      if (entity.type === 'module') {
        const state = entity.state()

        if (state === 'queued' && !this.queuedTestModules.has(entity.id)) {
          this.queuedTestModules.add(entity.id)
          queuedTestModules.push(entity)
        }

        if (state === 'pending' && !this.runningTestModules.has(entity.id)) {
          this.runningTestModules.add(entity.id)
          runningTestModules.push(entity)

          // If queue phase was fast, it's possible that it was never reported
          if (!this.queuedTestModules.has(entity.id)) {
            this.queuedTestModules.add(entity.id)
            queuedTestModules.push(entity)
          }
        }

        if (state !== 'pending' && state !== 'queued' && !this.finishedTestModules.has(entity.id)) {
          this.finishedTestModules.add(entity.id)
          finishedTestModules.push(entity)

          if (!this.queuedTestModules.has(entity.id)) {
            this.queuedTestModules.add(entity.id)
            queuedTestModules.push(entity)
          }

          // If module run was fast, it's possible that it was never reported to be running
          if (!this.runningTestModules.has(entity.id)) {
            this.runningTestModules.add(entity.id)
            runningTestModules.push(entity)
          }

          // Skipped tests need to be reported manually once test module has finished
          for (const test of entity.children.tests()) {
            if (!this.finishedTestCases.has(test.id)) {
              this.finishedTestCases.add(test.id)
              finishedTestCases.push(test)
            }
          }
        }
      }

      if (entity.type === 'test') {
        const state = entity.result().state

        if (state === 'pending' && !this.runningTestCases.has(entity.id)) {
          this.runningTestCases.add(entity.id)
          runningTestCases.push(entity)
        }

        if (state !== 'pending' && !this.finishedTestCases.has(entity.id)) {
          this.finishedTestCases.add(entity.id)
          finishedTestCases.push(entity)

          // If test finished quickly, it's possible that it was never reported as running
          if (!this.runningTestCases.has(entity.id)) {
            this.runningTestCases.add(entity.id)
            runningTestCases.push(entity)
          }
        }
      }
    }

    // Order of reporting is important here
    await Promise.all(finishedTestCases.map(testCase => this.vitest.report('onTestCaseFinished', testCase)))
    await Promise.all(finishedTestModules.map(module => this.vitest.report('onTestModuleFinished', module)))

    // TODO: Not needed as RPC has onQueued already. Do we want to remove that and centralize resolving here instead?
    // await Promise.all(queuedTestModules.map(module => this.vitest.report('onTestModuleQueued', module)))
    await Promise.all(runningTestModules.map(module => this.vitest.report('onTestModulePrepare', module)))
    await Promise.all(runningTestCases.map(testCase => this.vitest.report('onTestCasePrepare', testCase)))
  }

  async end() {
    // TODO
    await this.vitest.report('onTestRunEnd', [], [], 'passed')
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
