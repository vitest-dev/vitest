import type {
  Custom as RunnerCustomCase,
  Task as RunnerTask,
  Test as RunnerTestCase,
  File as RunnerTestFile,
  Suite as RunnerTestSuite,
  TaskMeta,
} from '@vitest/runner'
import type { TestError } from '@vitest/utils'
import { getTestName } from '../../utils/tasks'
import type { WorkspaceProject } from '../workspace'

class ReportedTaskImplementation {
  /**
   * Task instance.
   * @experimental Public runner task API is experimental and does not follow semver.
   */
  public readonly task: RunnerTask

  /**
   * Current task's project.
   * @experimental Public project API is experimental and does not follow semver.
   */
  public readonly project: WorkspaceProject

  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the file path and test position.
   */
  public readonly id: string

  /**
   * Location in the file where the test or suite is defined.
   */
  public readonly location: { line: number; column: number } | undefined

  protected constructor(
    task: RunnerTask,
    project: WorkspaceProject,
  ) {
    this.task = task
    this.project = project
    this.id = task.id
    this.location = task.location
  }

  static register(task: RunnerTask, project: WorkspaceProject) {
    const state = new this(task, project) as TestCase | TestSuite | TestFile
    storeTask(project, task, state)
    return state
  }
}

export class TestCase extends ReportedTaskImplementation {
  #fullName: string | undefined

  declare public readonly task: RunnerTestCase | RunnerCustomCase
  public readonly type: 'test' | 'custom' = 'test'

  /**
   * Direct reference to the test file where the test or suite is defined.
   */
  public readonly file: TestFile

  /**
   * Name of the test.
   */
  public readonly name: string

  /**
   * Options that the test was initiated with.
   */
  public readonly options: TaskOptions

  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile

  protected constructor(task: RunnerTestSuite | RunnerTestFile, project: WorkspaceProject) {
    super(task, project)

    this.name = task.name
    this.file = getReportedTask(project, task.file) as TestFile
    const suite = this.task.suite
    if (suite) {
      this.parent = getReportedTask(project, suite) as TestSuite
    }
    else {
      this.parent = this.file
    }
    this.options = buildOptions(task)
  }

  /**
   * Full name of the test including all parent suites separated with `>`.
   */
  public get fullName(): string {
    if (this.#fullName === undefined) {
      this.#fullName = getTestName(this.task, ' > ')
    }
    return this.#fullName
  }

  /**
   * Result of the test. Will be `undefined` if test is not finished yet or was just collected.
   */
  public result(): TestResult | undefined {
    const result = this.task.result
    if (!result || result.state === 'run') {
      return undefined
    }
    const state = result.state === 'fail'
      ? 'failed'
      : result.state === 'pass'
        ? 'passed'
        : 'skipped'
    return {
      state,
      errors: result.errors as TestError[] | undefined,
    } as TestResult
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
    if (!result || result.state === 'run' || !result.startTime) {
      return undefined
    }
    return {
      heap: result.heap,
      duration: result.duration!,
      startTime: result.startTime,
      retryCount: result.retryCount ?? 0,
      repeatCount: result.repeatCount ?? 0,
      flaky: !!result.retryCount && result.state === 'pass' && result.retryCount > 0,
    }
  }
}

class TestCollection {
  #task: RunnerTestSuite | RunnerTestFile
  #project: WorkspaceProject

  constructor(task: RunnerTestSuite | RunnerTestFile, project: WorkspaceProject) {
    this.#task = task
    this.#project = project
  }

  /**
   * Test or a suite at a specific index in the array.
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
   * The same collection, but in an array form for easier manipulation.
   */
  array(): (TestCase | TestSuite)[] {
    return Array.from(this)
  }

  /**
   * Iterates over all tests and suites in the collection.
   */
  *values(): IterableIterator<TestCase | TestSuite> {
    return this[Symbol.iterator]()
  }

  /**
   * Filters all tests that are part of this collection's suite and its children.
   */
  *allTests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase> {
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
   * Filters only tests that are part of this collection.
   */
  *tests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase> {
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
   * Filters only suites that are part of this collection.
   */
  *suites(): IterableIterator<TestSuite> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield child
      }
    }
  }

  /**
   * Filters all suites that are part of this collection's suite and its children.
   */
  *allSuites(): IterableIterator<TestSuite> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield child
        yield * child.children.allSuites()
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<TestSuite | TestCase> {
    for (const task of this.#task.tasks) {
      yield getReportedTask(this.#project, task) as TestSuite | TestCase
    }
  }
}

export type { TestCollection }

abstract class SuiteImplementation extends ReportedTaskImplementation {
  declare public readonly task: RunnerTestSuite | RunnerTestFile

  /**
   * Collection of suites and tests that are part of this suite.
   */
  public readonly children: TestCollection

  protected constructor(task: RunnerTestSuite | RunnerTestFile, project: WorkspaceProject) {
    super(task, project)
    this.children = new TestCollection(task, project)
  }
}

export class TestSuite extends SuiteImplementation {
  #fullName: string | undefined

  declare public readonly task: RunnerTestSuite
  public readonly type = 'suite'

  /**
   * Name of the test or the suite.
   */
  public readonly name: string

  /**
   * Direct reference to the test file where the test or suite is defined.
   */
  public readonly file: TestFile

  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile

  /**
   * Options that suite was initiated with.
   */
  public readonly options: TaskOptions

  protected constructor(task: RunnerTestSuite, project: WorkspaceProject) {
    super(task, project)

    this.name = task.name
    this.file = getReportedTask(project, task.file) as TestFile
    const suite = this.task.suite
    if (suite) {
      this.parent = getReportedTask(project, suite) as TestSuite
    }
    else {
      this.parent = this.file
    }
    this.options = buildOptions(task)
  }

  /**
   * Full name of the suite including all parent suites separated with `>`.
   */
  public get fullName(): string {
    if (this.#fullName === undefined) {
      this.#fullName = getTestName(this.task, ' > ')
    }
    return this.#fullName
  }
}

export class TestFile extends SuiteImplementation {
  declare public readonly task: RunnerTestFile
  declare public readonly location: undefined
  public readonly type = 'file'

  /**
   * This is usually an absolute UNIX file path.
   * It can be a virtual id if the file is not on the disk.
   * This value corresponds to Vite's `ModuleGraph` id.
   */
  public readonly moduleId: string

  protected constructor(task: RunnerTestFile, project: WorkspaceProject) {
    super(task, project)
    this.moduleId = task.filepath
  }

  /**
   * Useful information about the file like duration, memory usage, etc.
   * If the file was not executed yet, all diagnostic values will return `0`.
   */
  public diagnostic(): FileDiagnostic {
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
  mode: 'run' | 'only' | 'skip' | 'todo'
}

function buildOptions(task: RunnerTestCase | RunnerCustomCase | RunnerTestFile | RunnerTestSuite): TaskOptions {
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
  state: 'passed'
  /**
   * Errors that were thrown during the test execution.
   *
   * **Note**: If test was retried successfully, errors will still be reported.
   */
  errors: TestError[] | undefined
}

export interface TestResultFailed {
  state: 'failed'
  /**
   * Errors that were thrown during the test execution.
   */
  errors: TestError[]
}

export interface TestResultSkipped {
  state: 'skipped'
  errors: undefined
}

export interface TestDiagnostic {
  heap: number | undefined
  duration: number
  startTime: number
  retryCount: number
  repeatCount: number
  /**
   * If test passed on a second retry.
   */
  flaky: boolean
}

export interface FileDiagnostic {
  /**
   * The time it takes to import and initiate an environment.
   */
  environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  prepareDuration: number
  /**
   * The time it takes to import the test file.
   * This includes importing everything in the file and executing suite callbacks.
   */
  collectDuration: number
  /**
   * The time it takes to import the setup file.
   */
  setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the file.
   */
  duration: number
}

function getTestState(test: TestCase): TestResult['state'] | 'running' {
  const result = test.result()
  return result ? result.state : 'running'
}

function storeTask(project: WorkspaceProject, runnerTask: RunnerTask, reportedTask: TestCase | TestSuite | TestFile) {
  project.ctx.state.reportedTasksMap.set(runnerTask, reportedTask)
}

function getReportedTask(project: WorkspaceProject, runnerTask: RunnerTask): TestCase | TestSuite | TestFile {
  const reportedTask = project.ctx.state.reportedTasksMap.get(runnerTask)
  if (!reportedTask) {
    throw new Error(`Task instance was not found for ${runnerTask.type} ${runnerTask.name}`)
  }
  return reportedTask
}
