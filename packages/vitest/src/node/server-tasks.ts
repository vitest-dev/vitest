import type { Custom, File as FileTask, Suite as SuiteTask, TaskMeta, TaskResult, Test } from '@vitest/runner'
import { getFullName } from '../utils'
import type { ParsedStack } from '../types'
import type { WorkspaceProject } from './workspace'

// rule for function/getter
// getter is a readonly property that doesn't change in time
// method can return different objects depending on when it's called

const tasksMap = new WeakMap<
  Test | Custom | FileTask | SuiteTask,
  TestCase | TestFile | TestSuite
>()

class Task {
  #fullName: string | undefined

  /**
   * Task instance.
   * @experimental Public task API is experimental and does not follow semver.
   */
  public readonly task: Test | Custom | FileTask | SuiteTask

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

  constructor(
    task: Test | Custom | FileTask | SuiteTask,
    project: WorkspaceProject,
  ) {
    this.task = task
    this.project = project
    this.file = tasksMap.get(task.file) as TestFile
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
}

export class TestCase extends Task {
  declare public readonly task: Test | Custom
  public readonly type: 'test' | 'custom' = 'test'
  #options: TaskOptions | undefined
  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile

  constructor(task: SuiteTask | FileTask, project: WorkspaceProject) {
    super(task, project)

    const suite = this.task.suite
    if (suite) {
      this.parent = tasksMap.get(suite) as TestSuite
    }
    else {
      this.parent = this.file
    }
  }

  /**
   * Result of the test. Will be `undefined` if test is not finished yet or was just collected.
   */
  public result(): TestResult | undefined {
    const result = this.task.result
    if (!result) {
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
    }
  }

  /**
   * Custom metadata that was attached to the test during its execution.
   */
  public meta(): TaskMeta {
    return this.task.meta
  }

  /**
   * Options that the test was initiated with.
   */
  public options(): TaskOptions {
    if (this.#options === undefined) {
      this.#options = buildOptions(this.task)
    }
    // mode is the only one that can change dinamically
    this.#options.mode = this.task.mode
    return this.#options
  }

  /**
   * Useful information about the test like duration, memory usage, etc.
   */
  public diagnostic(): TestDiagnostic {
    const result = (this.task.result || {} as TaskResult)
    return {
      heap: result.heap,
      duration: result.duration,
      startTime: result.startTime,
      retryCount: result.retryCount,
      repeatCount: result.repeatCount,
    }
  }
}

export abstract class SuiteImplementation extends Task {
  declare public readonly task: SuiteTask | FileTask
  /**
   * Parent suite. If suite was called directly inside the file, the parent will be the file.
   */
  public readonly parent: TestSuite | TestFile

  constructor(task: SuiteTask | FileTask, project: WorkspaceProject) {
    super(task, project)

    const suite = this.task.suite
    if (suite) {
      this.parent = tasksMap.get(suite) as TestSuite
    }
    else {
      this.parent = this.file
    }
  }

  /**
   * Looks for a test by `name`.
   * If `name` is a string, it will look for an exact match.
   */
  public findTest(name: string | RegExp): TestCase | undefined {
    const isString = typeof name === 'string'
    for (const test of this.tests()) {
      if (test.name === name || (!isString && name.test(test.name))) {
        return test
      }
    }
  }

  /**
   * Looks for a test by `name`.
   * If `name` is a string, it will look for an exact match.
   */
  public findSuite(name: string | RegExp): TestSuite | undefined {
    const isString = typeof name === 'string'
    for (const suite of this.children()) {
      if (suite.type !== 'suite') {
        continue
      }
      if (suite.name === name || (!isString && name.test(suite.name))) {
        return suite
      }
    }
  }

  /**
   * An array of suites and tests that are part of this suite.
   */
  public *children(): Iterable<TestSuite | TestCase> {
    for (const task of this.task.tasks) {
      const taskInstance = tasksMap.get(task)
      if (!taskInstance) {
        throw new Error(`Task instance was not found for task ${task.id}`)
      }
      yield taskInstance as TestSuite | TestCase
    }
  }

  /**
   * An array of all tests that are part of this suite and its children.
   */
  public *tests(state?: TestResult['state'] | 'running'): Iterable<TestCase> {
    for (const child of this.children()) {
      if (child.type === 'suite') {
        yield * child.tests(state)
      }
      else if (state) {
        const result = child.result()
        if (!result && state === 'running') {
          yield child
        }
        else if (result && result.state === state) {
          yield child
        }
      }
      else {
        yield child
      }
    }
  }
}

export class TestSuite extends SuiteImplementation {
  declare public readonly task: SuiteTask
  public readonly type = 'suite'
  #options: TaskOptions | undefined

  /**
   * Options that suite was initiated with.
   */
  public options(): TaskOptions {
    if (this.#options === undefined) {
      this.#options = buildOptions(this.task)
    }
    return this.#options
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

  constructor(task: FileTask, project: WorkspaceProject) {
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

interface SerialisedError {
  message: string
  stack?: string
  name: string
  stacks?: ParsedStack[]
  [key: string]: unknown
}

interface TestError extends SerialisedError {
  diff?: string
  actual?: string
  expected?: string
}

interface TestResult {
  state: 'passed' | 'failed' | 'skipped'
  errors?: TestError[]
}

export interface TestDiagnostic {
  heap: number | undefined
  duration: number | undefined
  startTime: number | undefined
  retryCount: number | undefined
  repeatCount: number | undefined
}
