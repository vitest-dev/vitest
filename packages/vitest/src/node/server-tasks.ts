import type {
  Custom,
  File as FileTask,
  Task as RunnerTask,
  Suite as SuiteTask,
  TaskMeta,
  Test,
} from '@vitest/runner'
import { getFullName } from '../utils'
import type { ParsedStack } from '../types'
import type { WorkspaceProject } from './workspace'

// naming proposal:
// @vitest/runner: Task -> RunnerTask, Suite -> RunnerTestSuite, File -> RunnerTestFile, Test -> RunnerTestCase
// vitest/reporters: Task -> ReportedTask, Suite -> ReportedTestSuite, File -> ReportedTestFile, Test -> ReportedTestCase

// rule for function/getter
// getter is a readonly property that doesn't change in time
// method can return different objects depending on when it's called

export type ReportedTask = TestCase | TestFile | TestSuite

class Task {
  #fullName: string | undefined

  /**
   * Task instance.
   * @experimental Public task API is experimental and does not follow semver.
   */
  public readonly task: RunnerTask

  /**
   * Current task's project.
   * @experimental Public project API is experimental and does not follow semver.
   */
  public readonly project: WorkspaceProject
  /**
   * Direct reference to the test file where the test or suite is defined.
   */
  public readonly file: TestFile
  /**
   * Name of the test or the suite.
   */
  public readonly name: string
  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the file path and test position.
   */
  public readonly id: string
  /**
   * Full name of the test or the suite including all parent suites separated with `>`.
   */
  public readonly location: { line: number; column: number } | undefined

  protected constructor(
    task: RunnerTask,
    project: WorkspaceProject,
  ) {
    this.task = task
    this.project = project
    this.file = project.ctx.state.reportedTasksMap.get(task.file) as TestFile
    this.name = task.name
    this.id = task.id
    this.location = task.location
  }

  /**
   * Full name of the test or the suite including all parent suites separated with `>`.
   */
  public get fullName(): string {
    if (this.#fullName === undefined) {
      this.#fullName = getFullName(this.task, ' > ')
    }
    return this.#fullName
  }

  static register(task: RunnerTask, project: WorkspaceProject) {
    const state = new this(task, project) as ReportedTask
    storeTask(project, task, state)
    return state
  }
}

export class TestCase extends Task {
  declare public readonly task: Test | Custom
  public readonly type: 'test' | 'custom' = 'test'
  /**
   * Options that the test was initiated with.
   */
  public readonly options: TaskOptions
  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile

  protected constructor(task: SuiteTask | FileTask, project: WorkspaceProject) {
    super(task, project)

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

class TaskCollection {
  #task: SuiteTask | FileTask
  #project: WorkspaceProject

  constructor(task: SuiteTask | FileTask, project: WorkspaceProject) {
    this.#task = task
    this.#project = project
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
   * Looks for a test or a suite by `name` only inside the current suite.
   * If `name` is a string, it will look for an exact match.
   */
  find(type: 'test', name: string | RegExp): TestCase | undefined
  find(type: 'suite', name: string | RegExp): TestSuite | undefined
  find(type: 'test' | 'suite', name: string | RegExp): TestCase | TestSuite | undefined
  find(type: 'test' | 'suite', name: string | RegExp): TestCase | TestSuite | undefined {
    const isString = typeof name === 'string'
    for (const task of this) {
      if (task.type === type) {
        if (task.name === name || (!isString && name.test(task.name))) {
          return task
        }
      }
    }
  }

  /**
   * Looks for a test or a suite by `name` inside the current suite and its children.
   * If `name` is a string, it will look for an exact match.
   */
  deepFind(type: 'test', name: string | RegExp): TestCase | undefined
  deepFind(type: 'suite', name: string | RegExp): TestSuite | undefined
  deepFind(type: 'test' | 'suite', name: string | RegExp): TestCase | TestSuite | undefined
  deepFind(type: 'test' | 'suite', name: string | RegExp): TestCase | TestSuite | undefined {
    const isString = typeof name === 'string'
    for (const task of this) {
      if (task.type === type) {
        if (task.name === name || (!isString && name.test(task.name))) {
          return task
        }
      }
      if (task.type === 'suite') {
        const result = task.children.deepFind(type, name)
        if (result) {
          return result
        }
      }
    }
  }

  /**
   * Filters all tests that are part of this collection's suite and its children.
   */
  *deepTests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield * child.children.deepTests(state)
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
      if (child.type === 'test') {
        const testState = getTestState(child)
        if (state === testState) {
          yield child
        }
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
  *deepSuites(): IterableIterator<TestSuite> {
    for (const child of this) {
      if (child.type === 'suite') {
        yield child
        yield * child.children.deepSuites()
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<TestSuite | TestCase> {
    for (const task of this.#task.tasks) {
      const taskInstance = getReportedTask(this.#project, task)
      if (!taskInstance) {
        throw new Error(`Task instance was not found for task ${task.id}`)
      }
      yield taskInstance as TestSuite | TestCase
    }
  }
}

abstract class SuiteImplementation extends Task {
  declare public readonly task: SuiteTask | FileTask
  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile
  /**
   * Collection of suites and tests that are part of this suite.
   */
  public readonly children: TaskCollection

  protected constructor(task: SuiteTask | FileTask, project: WorkspaceProject) {
    super(task, project)

    const suite = this.task.suite
    if (suite) {
      this.parent = getReportedTask(project, suite) as TestSuite
    }
    else {
      this.parent = this.file
    }
    this.children = new TaskCollection(task, project)
  }
}

export class TestSuite extends SuiteImplementation {
  declare public readonly task: SuiteTask
  public readonly type = 'suite'
  /**
   * Options that suite was initiated with.
   */
  public readonly options: TaskOptions

  protected constructor(task: SuiteTask, project: WorkspaceProject) {
    super(task, project)
    this.options = buildOptions(task)
  }
}

export class TestFile extends SuiteImplementation {
  declare public readonly task: FileTask
  public readonly type = 'file'
  /**
   * This is usually an absolute UNIX file path.
   * It can be a virtual id if the file is not on the disk.
   * This value corresponds to Vite's `ModuleGraph` id.
   */
  public readonly moduleId: string

  protected constructor(task: FileTask, project: WorkspaceProject) {
    super(task, project)
    this.moduleId = task.filepath
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

function buildOptions(task: Test | Custom | FileTask | SuiteTask): TaskOptions {
  return {
    each: task.each,
    concurrent: task.concurrent,
    shuffle: task.shuffle,
    retry: task.retry,
    repeats: task.repeats,
    mode: task.mode,
  }
}

export interface SerialisedError {
  message: string
  stack?: string
  name: string
  stacks?: ParsedStack[]
  [key: string]: unknown
}

export interface TestError extends SerialisedError {
  diff?: string
  actual?: string
  expected?: string
}

export type TestResult = TestResultPassed | TestResultFailed | TestResultSkipped

interface TestResultPassed {
  state: 'passed'
  errors: undefined
}

interface TestResultFailed {
  state: 'failed'
  errors: TestError[]
}

interface TestResultSkipped {
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

function getTestState(test: TestCase): TestResult['state'] | 'running' {
  const result = test.result()
  return result ? result.state : 'running'
}

function storeTask(project: WorkspaceProject, runnerTask: RunnerTask, reportedTask: ReportedTask) {
  project.ctx.state.reportedTasksMap.set(runnerTask, reportedTask)
}

function getReportedTask(project: WorkspaceProject, runnerTask: RunnerTask): ReportedTask {
  const reportedTask = project.ctx.state.reportedTasksMap.get(runnerTask)
  if (!reportedTask) {
    throw new Error(`Task instance was not found for task ${runnerTask.id}`)
  }
  return reportedTask
}
