import type {
  Task as RunnerTask,
  Test as RunnerTestCase,
  File as RunnerTestFile,
  Suite as RunnerTestSuite,
  TaskMeta,
} from '@vitest/runner'
import type { SerializedError, TestError } from '@vitest/utils'
import type { TestProject } from '../project'

class ReportedTaskImplementation {
  /**
   * Task instance.
   * @internal
   */
  public readonly task: RunnerTask

  /**
   * The project associated with the test or suite.
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
   * Test results.
   * - **pending**: Test was collected, but didn't finish running yet.
   * - **passed**: Test passed successfully
   * - **failed**: Test failed to execute
   * - **skipped**: Test was skipped during collection or dynamically with `ctx.skip()`.
   */
  public result(): TestResult {
    const result = this.task.result
    const mode = result?.state || this.task.mode

    if (!result && (mode === 'skip' || mode === 'todo')) {
      return {
        state: 'skipped',
        note: undefined,
        errors: undefined,
      }
    }

    if (!result || result.state === 'run' || result.state === 'queued') {
      return {
        state: 'pending',
        errors: undefined,
      }
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
    if (!result || !result.startTime) {
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
  *allTests(state?: TestState): Generator<TestCase, undefined, void> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield * child.children.allTests(state)
      }
      else if (state) {
        const testState = child.result().state
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
  *tests(state?: TestState): Generator<TestCase, undefined, void> {
    for (const child of this) {
      if (child.type !== 'test') {
        continue
      }

      if (state) {
        const testState = child.result().state
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

export type ReportedHookContext = {
  readonly name: 'beforeAll' | 'afterAll'
  readonly entity: TestSuite | TestModule
} | {
  readonly name: 'beforeEach' | 'afterEach'
  readonly entity: TestCase
}

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
   * Errors that happened outside of the test run during collection, like syntax errors.
   */
  public errors(): SerializedError[] {
    return (this.task.result?.errors as SerializedError[] | undefined) || []
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
   * Checks the running state of the suite.
   */
  public state(): TestSuiteState {
    return getSuiteState(this.task)
  }

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
   * It can be a virtual ID if the file is not on the disk.
   * This value corresponds to the ID in the Vite's module graph.
   */
  public readonly moduleId: string

  /** @internal */
  protected constructor(task: RunnerTestFile, project: TestProject) {
    super(task, project)
    this.moduleId = task.filepath
  }

  /**
   * Checks the running state of the test file.
   */
  public state(): TestModuleState {
    const state = this.task.result?.state
    if (state === 'queued') {
      return 'queued'
    }
    return getSuiteState(this.task)
  }

  /**
   * Checks if the module has any failed tests.
   * This will also return `false` if module failed during collection.
   */
  declare public ok: () => boolean

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
  readonly each: boolean | undefined
  readonly fails: boolean | undefined
  readonly concurrent: boolean | undefined
  readonly shuffle: boolean | undefined
  readonly retry: number | undefined
  readonly repeats: number | undefined
  readonly mode: 'run' | 'only' | 'skip' | 'todo'
}

function buildOptions(
  task: RunnerTestCase | RunnerTestSuite,
): TaskOptions {
  return {
    each: task.each,
    fails: task.type === 'test' && task.fails,
    concurrent: task.concurrent,
    shuffle: task.shuffle,
    retry: task.retry,
    repeats: task.repeats,
    // runner types are too broad, but the public API should be more strict
    // the queued state exists only on Files and this method is called
    // only for tests and suites
    mode: task.mode as TaskOptions['mode'],
  }
}

export type TestSuiteState = 'skipped' | 'pending' | 'failed' | 'passed'
export type TestModuleState = TestSuiteState | 'queued'
export type TestState = TestResult['state']

export type TestResult =
  | TestResultPassed
  | TestResultFailed
  | TestResultSkipped
  | TestResultPending

export interface TestResultPending {
  /**
   * The test was collected, but didn't finish running yet.
   */
  readonly state: 'pending'
  /**
   * Pending tests have no errors.
   */
  readonly errors: undefined
}

export interface TestResultPassed {
  /**
   * The test passed successfully.
   */
  readonly state: 'passed'
  /**
   * Errors that were thrown during the test execution.
   *
   * **Note**: If test was retried successfully, errors will still be reported.
   */
  readonly errors: ReadonlyArray<TestError> | undefined
}

export interface TestResultFailed {
  /**
   * The test failed to execute.
   */
  readonly state: 'failed'
  /**
   * Errors that were thrown during the test execution.
   */
  readonly errors: ReadonlyArray<TestError>
}

export interface TestResultSkipped {
  /**
   * The test was skipped with `only` (on another test), `skip` or `todo` flag.
   * You can see which one was used in the `options.mode` option.
   */
  readonly state: 'skipped'
  /**
   * Skipped tests have no errors.
   */
  readonly errors: undefined
  /**
   * A custom note passed down to `ctx.skip(note)`.
   */
  readonly note: string | undefined
}

export interface TestDiagnostic {
  /**
   * If the duration of the test is above `slowTestThreshold`.
   */
  readonly slow: boolean
  /**
   * The amount of memory used by the test in bytes.
   * This value is only available if the test was executed with `logHeapUsage` flag.
   */
  readonly heap: number | undefined
  /**
   * The time it takes to execute the test in ms.
   */
  readonly duration: number
  /**
   * The time in ms when the test started.
   */
  readonly startTime: number
  /**
   * The amount of times the test was retried.
   */
  readonly retryCount: number
  /**
   * The amount of times the test was repeated as configured by `repeats` option.
   * This value can be lower if the test failed during the repeat and no `retry` is configured.
   */
  readonly repeatCount: number
  /**
   * If test passed on a second retry.
   */
  readonly flaky: boolean
}

export interface ModuleDiagnostic {
  /**
   * The time it takes to import and initiate an environment.
   */
  readonly environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  readonly prepareDuration: number
  /**
   * The time it takes to import the test module.
   * This includes importing everything in the module and executing suite callbacks.
   */
  readonly collectDuration: number
  /**
   * The time it takes to import the setup module.
   */
  readonly setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the module.
   */
  readonly duration: number
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

function getSuiteState(task: RunnerTestSuite | RunnerTestFile): TestSuiteState {
  const mode = task.mode
  const state = task.result?.state
  if (mode === 'skip' || mode === 'todo' || state === 'skip' || state === 'todo') {
    return 'skipped'
  }
  if (state == null || state === 'run' || state === 'only') {
    return 'pending'
  }
  if (state === 'fail') {
    return 'failed'
  }
  if (state === 'pass') {
    return 'passed'
  }
  throw new Error(`Unknown suite state: ${state}`)
}
