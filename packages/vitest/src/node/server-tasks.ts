import type { Custom, File as FileTask, Suite as SuiteTask, TaskMeta, TaskResult, Test } from '@vitest/runner'
import { getFullName } from '../utils'
import type { WorkspaceProject } from './workspace'

const tasksMap = new WeakMap<
  Test | Custom | FileTask | SuiteTask,
  TestCase | File | Suite
>()

class Task {
  #fullName: string | undefined
  #project: WorkspaceProject

  constructor(
    public readonly task: Test | Custom | FileTask | SuiteTask,
    project: WorkspaceProject,
  ) {
    this.#project = project
  }

  public project(): WorkspaceProject {
    return this.#project
  }

  public file(): File {
    return tasksMap.get(this.task.file) as File
  }

  public parent(): Suite | File {
    const suite = this.task.suite
    if (suite) {
      return tasksMap.get(suite) as Suite
    }
    return this.file()
  }

  public get name(): string {
    return this.task.name
  }

  public get fullName(): string {
    if (this.#fullName === undefined) {
      this.#fullName = getFullName(this.task, ' > ')
    }
    return this.#fullName
  }

  public get id(): string {
    return this.task.id
  }

  public get location(): { line: number; column: number } | undefined {
    return this.task.location
  }
}

export class TestCase extends Task {
  declare public readonly task: Test | Custom
  public readonly type = 'test'
  #options: TaskOptions | undefined

  public get meta(): TaskMeta {
    return this.task.meta
  }

  public options(): TaskOptions {
    if (this.#options === undefined) {
      this.#options = buildOptions(this.task)
      // mode is the only one that can change dinamically
      this.#options.mode = this.task.mode
    }
    return this.#options
  }

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

  public children(): (Suite | TestCase)[] {
    return this.task.tasks.map((task) => {
      const taskInstance = tasksMap.get(task)
      if (!taskInstance) {
        throw new Error(`Task instance was not found for task ${task.id}`)
      }
      return taskInstance as Suite | TestCase
    })
  }
}

export class Suite extends SuiteImplementation {
  declare public readonly task: SuiteTask
  public readonly type = 'suite'
  #options: TaskOptions | undefined

  public options(): TaskOptions {
    if (this.#options === undefined) {
      this.#options = buildOptions(this.task)
    }
    return this.#options
  }
}

export class File extends SuiteImplementation {
  declare public readonly task: FileTask
  public readonly type = 'file'

  public get moduleId(): string {
    return this.task.filepath
  }

  public get location(): undefined {
    return undefined
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

export interface TestDiagnostic {
  heap: number | undefined
  duration: number | undefined
  startTime: number | undefined
  retryCount: number | undefined
  repeatCount: number | undefined
}
