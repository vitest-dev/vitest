import type {
  Task as RunnerTask,
  Test as RunnerTestCase,
  File as RunnerTestFile,
  Suite as RunnerTestSuite,
  TaskMeta,
} from '@vitest/runner'
import type { TestError } from '@vitest/utils'
import type { TestProject } from '../project'

class ReportedTaskImplementation {
  /**
   * Task instance.
   * @internal
   */
  public readonly task: RunnerTask

  /**
   * The project assosiacted with the test or suite.
   */
  public readonly project: TestProject

  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the project name, module url and test order.
   */
  public readonly id: string

  /**
   * Location in the module where the test or suite is defined.
   */
  public readonly location: { line: number; column: number } | undefined

  /** @internal */
  protected constructor(
    task: RunnerTask,
    project: TestProject,
  ) {
    this.task = task
    this.project = project
    this.id = task.id
    this.location = task.location
  }

  /**
   * Checks if the test did not fail the suite.
   * If the test is not finished yet or was skipped, it will return `true`.
   */
  public ok(): boolean {
    const result = this.task.result
    return !result || result.state !== 'fail'
  }

  /**
   * Creates a new reported task instance and stores it in the project's state for future use.
   * @internal
   */
  static register(task: RunnerTask, project: TestProject) {
    const state = new this(task, project) as TestCase | TestSuite | TestModule
    storeTask(project, task, state)
    return state
  }
}

export class TestCase extends ReportedTaskImplementation {
  #fullName: string | undefined

  /** @internal */
  declare public readonly task: RunnerTestCase
  public readonly type = 'test'

  /**
   * Direct reference to the test module where the test or suite is defined.
   */
  public readonly module: TestModule

  /**
   * Name of the test.
   */
  public readonly name: string

  /**
   * Options that the test was initiated with.
   */
  public readonly options: TaskOptions

  /**
   * Parent suite. If the test was called directly inside the module, the parent will be the module itself.
   */
  public readonly parent: TestSuite | TestModule

  /** @internal */
  protected constructor(task: RunnerTestCase, project: TestProject) {
    super(task, project)

    this.name = task.name
    this.module = getReportedTask(project, task.file) as TestModule
    const suite = this.task.suite
    if (suite) {
      this.parent = getReportedTask(project, suite) as TestSuite
    }
    else {
      this.parent = this.module
    }
    this.options = buildOptions(task)
  }

  /**
   * Full name of the test including all parent suites separated with `>`.
   */
  public get fullName(): string {
    if (this.#fullName === undefined) {
      if (this.parent.type !== 'module') {
        this.#fullName = `${this.parent.fullName} > ${this.name}`
      }
      else {
        this.#fullName = this.name
      }
    }
    return this.#fullName
  }

  /**
   * Test results. Will be `undefined` if test is skipped, not finished yet or was just collected.
   */
  public result(): TestResult | undefined {
    const result = this.task.result
    if (!result || result.state === 'run' || result.state === 'queued') {
      return undefined
    }
    const state = result.state === 'fail'
      ? 'failed' as const
      : result.state === 'pass'
        ? 'passed' as const
        : 'skipped' as const
    if (state === 'skipped') {
      return {
        state,
        note: result.note,
        errors: undefined,
      } satisfies TestResultSkipped
    }
    if (state === 'passed') {
      return {
        state,
        errors: result.errors as TestError[] | undefined,
      } satisfies TestResultPassed
    }
    return {
      state,
      errors: (result.errors || []) as TestError[],
    } satisfies TestResultFailed
  }

  /**
   * Checks if the test was skipped during collection or dynamically with `ctx.skip()`.
   */
  public skipped(): boolean {
    const mode = this.task.result?.state || this.task.mode
    return mode === 'skip' || mode === 'todo'
  }

  /**
   * Custom metadata that was attached to the test during its execution.
   */
  public meta(): TaskMeta {
    return this.task.meta
  }

  /**
   * Useful information about the test like duration, memory usage, etc.
   * Diagnostic is only available after the test has finished.
   */
  public diagnostic(): TestDiagnostic | undefined {
    const result = this.task.result
    // startTime should always be available if the test has properly finished
    if (!result || result.state === 'run' || result.state === 'queued' || !result.startTime) {
      return undefined
    }
    const duration = result.duration || 0
    const slow = duration > this.project.globalConfig.slowTestThreshold
    return {
      slow,
      heap: result.heap,
      duration,
      startTime: result.startTime,
      retryCount: result.retryCount ?? 0,
      repeatCount: result.repeatCount ?? 0,
      flaky: !!result.retryCount && result.state === 'pass' && result.retryCount > 0,
    }
  }
}

class TestCollection {
  #task: RunnerTestSuite | RunnerTestFile
  #project: TestProject

  constructor(task: RunnerTestSuite | RunnerTestFile, project: TestProject) {
    this.#task = task
    this.#project = project
  }

  /**
   * Returns the test or suite at a specific index.
   */
  at(index: number): TestCase | TestSuite | undefined {
    if (index < 0) {
      index = this.size + index
    }
    return getReportedTask(this.#project, this.#task.tasks[index]) as TestCase | TestSuite | undefined
  }

  /**
   * The number of tests and suites in the collection.
   */
  get size(): number {
    return this.#task.tasks.length
  }

  /**
   * Returns the collection in array form for easier manipulation.
   */
  array(): (TestCase | TestSuite)[] {
    return Array.from(this)
  }

  /**
   * Filters all tests that are part of this collection and its children.
   */
  *allTests(state?: TestResult['state'] | 'running'): Generator<TestCase, undefined, void> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield * child.children.allTests(state)
      }
      else if (state) {
        const testState = getTestState(child)
        if (state === testState) {
          yield child
        }
      }
      else {
        yield child
      }
    }
  }

  /**
   * Filters only the tests that are part of this collection.
   */
  *tests(state?: TestResult['state'] | 'running'): Generator<TestCase, undefined, void> {
    for (const child of this) {
      if (child.type !== 'test') {
        continue
      }

      if (state) {
        const testState = getTestState(child)
        if (state === testState) {
          yield child
        }
      }
      else {
        yield child
      }
    }
  }

  /**
   * Filters only the suites that are part of this collection.
   */
  *suites(): Generator<TestSuite, undefined, void> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield child
      }
    }
  }

  /**
   * Filters all suites that are part of this collection and its children.
   */
  *allSuites(): Generator<TestSuite, undefined, void> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield child
        yield * child.children.allSuites()
      }
    }
  }

  *[Symbol.iterator](): Generator<TestSuite | TestCase, undefined, void> {
    for (const task of this.#task.tasks) {
      yield getReportedTask(this.#project, task) as TestSuite | TestCase
    }
  }
}

export type { TestCollection }

abstract class SuiteImplementation extends ReportedTaskImplementation {
  /** @internal */
  declare public readonly task: RunnerTestSuite | RunnerTestFile

  /**
   * Collection of suites and tests that are part of this suite.
   */
  public readonly children: TestCollection

  /** @internal */
  protected constructor(task: RunnerTestSuite | RunnerTestFile, project: TestProject) {
    super(task, project)
    this.children = new TestCollection(task, project)
  }

  /**
   * Checks if the suite was skipped during collection.
   */
  public skipped(): boolean {
    const mode = this.task.mode
    return mode === 'skip' || mode === 'todo'
  }

  /**
   * Errors that happened outside of the test run during collection, like syntax errors.
   */
  public errors(): TestError[] {
    return (this.task.result?.errors as TestError[] | undefined) || []
  }
}

export class TestSuite extends SuiteImplementation {
  #fullName: string | undefined

  /** @internal */
  declare public readonly task: RunnerTestSuite
  public readonly type = 'suite'

  /**
   * Name of the test or the suite.
   */
  public readonly name: string

  /**
   * Direct reference to the test module where the test or suite is defined.
   */
  public readonly module: TestModule

  /**
   * Parent suite. If suite was called directly inside the module, the parent will be the module itself.
   */
  public readonly parent: TestSuite | TestModule

  /**
   * Options that suite was initiated with.
   */
  public readonly options: TaskOptions

  /** @internal */
  protected constructor(task: RunnerTestSuite, project: TestProject) {
    super(task, project)

    this.name = task.name
    this.module = getReportedTask(project, task.file) as TestModule
    const suite = this.task.suite
    if (suite) {
      this.parent = getReportedTask(project, suite) as TestSuite
    }
    else {
      this.parent = this.module
    }
    this.options = buildOptions(task)
  }

  /**
   * Checks if the suite has any failed tests.
   * This will also return `false` if suite failed during collection.
   */
  declare public ok: () => boolean

  /**
   * Full name of the suite including all parent suites separated with `>`.
   */
  public get fullName(): string {
    if (this.#fullName === undefined) {
      if (this.parent.type !== 'module') {
        this.#fullName = `${this.parent.fullName} > ${this.name}`
      }
      else {
        this.#fullName = this.name
      }
    }
    return this.#fullName
  }
}

export class TestModule extends SuiteImplementation {
  /** @internal */
  declare public readonly task: RunnerTestFile
  declare public readonly location: undefined
  public readonly type = 'module'

  /**
   * This is usually an absolute UNIX file path.
   * It can be a virtual id if the file is not on the disk.
   * This value corresponds to Vite's `ModuleGraph` id.
   */
  public readonly moduleId: string

  /** @internal */
  protected constructor(task: RunnerTestFile, project: TestProject) {
    super(task, project)
    this.moduleId = task.filepath
  }

  /**
   * Checks if the module has any failed tests.
   * This will also return `false` if module failed during collection.
   */
  declare public ok: () => boolean

  /**
   * Checks if the module was skipped and didn't run.
   */
  declare public skipped: () => boolean

  /**
   * Useful information about the module like duration, memory usage, etc.
   * If the module was not executed yet, all diagnostic values will return `0`.
   */
  public diagnostic(): ModuleDiagnostic {
    const setupDuration = this.task.setupDuration || 0
    const collectDuration = this.task.collectDuration || 0
    const prepareDuration = this.task.prepareDuration || 0
    const environmentSetupDuration = this.task.environmentLoad || 0
    const duration = this.task.result?.duration || 0
    return {
      environmentSetupDuration,
      prepareDuration,
      collectDuration,
      setupDuration,
      duration,
    }
  }
}

export interface TaskOptions {
  each: boolean | undefined
  concurrent: boolean | undefined
  shuffle: boolean | undefined
  retry: number | undefined
  repeats: number | undefined
  mode: 'run' | 'only' | 'skip' | 'todo' | 'queued'
}

function buildOptions(
  task: RunnerTestCase | RunnerTestFile | RunnerTestSuite,
): TaskOptions {
  return {
    each: task.each,
    concurrent: task.concurrent,
    shuffle: task.shuffle,
    retry: task.retry,
    repeats: task.repeats,
    mode: task.mode,
  }
}

export type TestResult = TestResultPassed | TestResultFailed | TestResultSkipped

export interface TestResultPassed {
  /**
   * The test passed successfully.
   */
  state: 'passed'
  /**
   * Errors that were thrown during the test execution.
   *
   * **Note**: If test was retried successfully, errors will still be reported.
   */
  errors: TestError[] | undefined
}

export interface TestResultFailed {
  /**
   * The test failed to execute.
   */
  state: 'failed'
  /**
   * Errors that were thrown during the test execution.
   */
  errors: TestError[]
}

export interface TestResultSkipped {
  /**
   * The test was skipped with `only` (on another test), `skip` or `todo` flag.
   * You can see which one was used in the `options.mode` option.
   */
  state: 'skipped'
  /**
   * Skipped tests have no errors.
   */
  errors: undefined
  /**
   * A custom note passed down to `ctx.skip(note)`.
   */
  note: string | undefined
}

export interface TestDiagnostic {
  /**
   * If the duration of the test is above `slowTestThreshold`.
   */
  slow: boolean
  /**
   * The amount of memory used by the test in bytes.
   * This value is only available if the test was executed with `logHeapUsage` flag.
   */
  heap: number | undefined
  /**
   * The time it takes to execute the test in ms.
   */
  duration: number
  /**
   * The time in ms when the test started.
   */
  startTime: number
  /**
   * The amount of times the test was retried.
   */
  retryCount: number
  /**
   * The amount of times the test was repeated as configured by `repeats` option.
   * This value can be lower if the test failed during the repeat and no `retry` is configured.
   */
  repeatCount: number
  /**
   * If test passed on a second retry.
   */
  flaky: boolean
}

export interface ModuleDiagnostic {
  /**
   * The time it takes to import and initiate an environment.
   */
  environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  prepareDuration: number
  /**
   * The time it takes to import the test module.
   * This includes importing everything in the module and executing suite callbacks.
   */
  collectDuration: number
  /**
   * The time it takes to import the setup module.
   */
  setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the module.
   */
  duration: number
}

function getTestState(test: TestCase): TestResult['state'] | 'running' {
  if (test.skipped()) {
    return 'skipped'
  }
  const result = test.result()
  return result ? result.state : 'running'
}

function storeTask(
  project: TestProject,
  runnerTask: RunnerTask,
  reportedTask: TestCase | TestSuite | TestModule,
): void {
  project.vitest.state.reportedTasksMap.set(runnerTask, reportedTask)
}

function getReportedTask(
  project: TestProject,
  runnerTask: RunnerTask,
): TestCase | TestSuite | TestModule {
  const reportedTask = project.vitest.state.getReportedEntity(runnerTask)
  if (!reportedTask) {
    throw new Error(
      `Task instance was not found for ${runnerTask.type} "${runnerTask.name}"`,
    )
  }
  return reportedTask
}
