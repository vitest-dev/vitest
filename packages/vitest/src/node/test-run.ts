import type { File as RunnerTestFile, TaskResultPack } from '@vitest/runner'
import type { SerializedError } from '../public/utils'
import type { UserConsoleLog } from '../types/general'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestCase, TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'

export class TestRun {
  private tests = emptyCounters()
  private suites = emptyCounters()

  // Internal state to prevent reporting duplicates and guaranteeing correct order
  private runningTestModules = new Set<TestModule['id']>()
  private finishedTestModules = new Set<TestModule['id']>()

  private runningTestCases = new Set<TestCase['id']>()
  private finishedTestCases = new Set<TestCase['id']>()

  constructor(private vitest: Vitest) {}

  async start(specifications: TestSpecification[]) {
    this.tests = emptyCounters()
    this.suites = emptyCounters()
    this.suites.total = specifications.length

    this.runningTestModules.clear()
    this.finishedTestModules.clear()
    this.runningTestCases.clear()
    this.finishedTestCases.clear()

    await this.vitest.report('onTestRunStart', specifications)
  }

  async enqueued(project: TestProject, file: RunnerTestFile) {
    this.vitest.state.collectFiles(project, [file])
    const testModule = this.vitest.state.getReportedEntity(file) as TestModule
    await this.vitest.report('onTestModuleQueued', testModule)
  }

  async collected(project: TestProject, files: RunnerTestFile[]) {
    this.vitest.state.collectFiles(project, files)
    await Promise.all([
      this.vitest.report('onCollected', files),
      ...files.map((file) => {
        const testModule = this.vitest.state.getReportedEntity(file) as TestModule
        return this.vitest.report('onTestModuleCollected', testModule)
      }),
    ])
  }

  async log(log: UserConsoleLog) {
    this.vitest.state.updateUserLog(log)
    await this.vitest.report('onUserConsoleLog', log)
  }

  async updated(update: TaskResultPack[]) {
    this.vitest.state.updateTasks(update)

    const runningTestModules: TestModule[] = []
    const finishedTestModules: TestModule[] = []

    const runningTestCases: TestCase[] = []
    const finishedTestCases: TestCase[] = []

    for (const [id] of update) {
      const task = this.vitest.state.idMap.get(id)
      if (!task) {
        continue
      }

      const entity = this.vitest.state.getReportedEntity(task)

      if (!entity) {
        continue
      }

      if (entity.type === 'module') {
        const state = entity.state()

        if (state === 'pending' && !this.runningTestModules.has(entity.id)) {
          this.runningTestModules.add(entity.id)
          runningTestModules.push(entity)
        }

        if (state !== 'pending' && state !== 'queued' && !this.finishedTestModules.has(entity.id)) {
          this.finishedTestModules.add(entity.id)
          finishedTestModules.push(entity)

          // If module run was fast, it's possible that it was never reported to be running
          if (!this.runningTestModules.has(entity.id)) {
            this.runningTestModules.add(entity.id)
            runningTestModules.push(entity)
          }

          // Skipped tests need to be reported manually once test module has finished
          for (const test of entity.children.allTests()) {
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

    // TODO: error handling

    // TODO: what is the order or reports here?
    // "onTaskUpdate" in parallel with others or before all or after all?
    await this.vitest.report('onTaskUpdate', update)

    // Order of reporting is important here
    await Promise.all(finishedTestCases.map(testCase => this.vitest.report('onTestCaseFinished', testCase)))
    await Promise.all(finishedTestModules.map(module => this.vitest.report('onTestModuleFinished', module)))

    await Promise.all(runningTestModules.map(module => this.vitest.report('onTestModulePrepare', module)))
    await Promise.all(runningTestCases.map(testCase => this.vitest.report('onTestCasePrepare', testCase)))
  }

  async end(specifications: TestSpecification[], errors: unknown[], coverage?: unknown) {
    const state = this.vitest.isCancelling
      ? 'interrupted'
      // by this point, the run will be marked as failed if there are any errors,
      // should it be done by testRun.end?
      : process.exitCode
        ? 'failed'
        : 'passed'

    const modules = specifications.map((spec) => {
      if (!spec.module) {
        const error = new Error(`Module "${spec.moduleId}" was not found when finishing test run. This is a bug in Vitest. Please, open an issue.`)
        this.vitest.state.catchError(error, 'Unhandled Error')
        errors.push(error)
        return null
      }
      return spec.module
    }).filter(s => s != null)
    const files = modules.map(m => m.task)

    await Promise.all([
      this.vitest.report('onTestRunEnd', modules, errors as SerializedError[], state),
      // TODO: in a perfect world, the coverage should be done in parallel to `onFinished`
      this.vitest.report('onFinished', files, errors, coverage),
    ])
    await this.vitest.report('onCoverage', coverage)
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
