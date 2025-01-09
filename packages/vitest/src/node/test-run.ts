import type { File as RunnerTestFile, TaskResultPack } from '@vitest/runner'
import type { SerializedError } from '../public/utils'
import type { UserConsoleLog } from '../types/general'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { ReportedHookContext, TestCase, TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'

export class TestRun {
  private tests = emptyCounters()
  private suites = emptyCounters()

  constructor(private vitest: Vitest) {}

  async start(specifications: TestSpecification[]) {
    this.tests = emptyCounters()
    this.suites = emptyCounters()
    this.suites.total = specifications.length

    await this.vitest.report('onTestRunStart', [...specifications])
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

    // These are used to guarantee correct reporting order
    const runningTestModules: TestModule[] = []
    const finishedTestModules: TestModule[] = []

    const runningTestCases: TestCase[] = []
    const finishedTestCases: TestCase[] = []

    const startingHooks: ReportedHookContext[] = []
    const endingHooks: ReportedHookContext[] = []

    for (const [id,,,events] of update) {
      const task = this.vitest.state.idMap.get(id)
      const entity = task && this.vitest.state.getReportedEntity(task)

      if (!entity) {
        continue
      }

      for (const event of events) {
        if (event === 'suite-prepare' && entity.type === 'module') {
          runningTestModules.push(entity)
        }

        if (event === 'suite-finished' && entity.type === 'module') {
          finishedTestModules.push(entity)

          // Skipped tests need to be reported manually once test module has finished
          for (const test of entity.children.allTests()) {
            if (test.result().state === 'skipped') {
              runningTestCases.push(test)
              finishedTestCases.push(test)
            }
          }
        }

        if (event === 'test-prepare' && entity.type === 'test') {
          runningTestCases.push(entity)
        }

        if (event === 'test-finished' && entity.type === 'test') {
          finishedTestCases.push(entity)
        }

        if ((event === 'suite-hook-start' || event === 'suite-hook-end') && entity.task.result?.hooks) {
          for (const hook of Object.keys(entity.task.result.hooks)) {
            const name = hook as keyof (typeof entity.task.result.hooks)

            if (event === 'suite-hook-start') {
              startingHooks.push({ name, entity } as ReportedHookContext)
            }
            else {
              endingHooks.push({ name, entity } as ReportedHookContext)
            }
          }
        }
      }
    }

    // TODO: error handling

    // TODO: what is the order or reports here?
    // "onTaskUpdate" in parallel with others or before all or after all?
    await this.vitest.report('onTaskUpdate', update)

    await Promise.all(runningTestModules.map(module => this.vitest.report('onTestModuleStart', module)))

    for (const testCase of runningTestCases) {
      await this.vitest.report('onTestCaseStart', testCase)

      const startIndex = startingHooks.findIndex(hook => hook.entity.id === testCase.id)
      if (startIndex >= 0) {
        await this.vitest.report('onHookStart', startingHooks.splice(startIndex, 1)[0])
      }

      const endIndex = endingHooks.findIndex(hook => hook.entity.id === testCase.id)
      if (endIndex >= 0) {
        await this.vitest.report('onHookEnd', endingHooks.splice(endIndex, 1)[0])
      }

      const finishedIndex = finishedTestCases.findIndex(t => t.id === testCase.id)
      if (finishedIndex >= 0) {
        finishedTestCases.splice(finishedIndex, 1)
        await this.vitest.report('onTestCaseEnd', testCase)
      }
    }

    await Promise.all(startingHooks.map(hook => this.vitest.report('onHookStart', hook)))
    await Promise.all(endingHooks.map(hook => this.vitest.report('onHookEnd', hook)))

    await Promise.all(finishedTestCases.map(testCase => this.vitest.report('onTestCaseEnd', testCase)))
    await Promise.all(finishedTestModules.map(module => this.vitest.report('onTestModuleEnd', module)))
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
      if (!spec.testModule) {
        const error = new Error(`Module "${spec.moduleId}" was not found when finishing test run. This is a bug in Vitest. Please, open an issue.`)
        this.vitest.state.catchError(error, 'Unhandled Error')
        errors.push(error)
        return null
      }
      return spec.testModule
    }).filter(s => s != null)
    const files = modules.map(m => m.task)

    await Promise.all([
      this.vitest.report('onTestRunEnd', modules, [...errors] as SerializedError[], state),
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
