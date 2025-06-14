import type { File, Task, TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../types/general'
import type { TestProject } from './project'
import type { MergedBlobs } from './reporters/blob'
import type { OnUnhandledErrorCallback } from './types/config'
import { createFileTask } from '@vitest/runner/utils'
import { TestCase, TestModule, TestSuite } from './reporters/reported-tasks'

function isAggregateError(err: unknown): err is AggregateError {
  if (typeof AggregateError !== 'undefined' && err instanceof AggregateError) {
    return true
  }

  return err instanceof Error && 'errors' in err
}

export class StateManager {
  filesMap: Map<string, File[]> = new Map()
  pathsSet: Set<string> = new Set()
  idMap: Map<string, Task> = new Map()
  taskFileMap: WeakMap<Task, File> = new WeakMap()
  errorsSet: Set<unknown> = new Set()
  processTimeoutCauses: Set<string> = new Set()
  reportedTasksMap: WeakMap<Task, TestModule | TestCase | TestSuite> = new WeakMap()
  blobs?: MergedBlobs

  onUnhandledError?: OnUnhandledErrorCallback

  constructor(
    options: {
      onUnhandledError?: OnUnhandledErrorCallback
    },
  ) {
    this.onUnhandledError = options.onUnhandledError
  }

  catchError(error: unknown, type: string): void {
    if (isAggregateError(error)) {
      return error.errors.forEach(error => this.catchError(error, type))
    }

    if (typeof error === 'object' && error !== null) {
      (error as Record<string, unknown>).type = type
    }
    else {
      error = { type, message: error }
    }

    const _error = error as Record<string, any>
    if (_error && typeof _error === 'object' && _error.code === 'VITEST_PENDING') {
      const task = this.idMap.get(_error.taskId)
      if (task) {
        task.mode = 'skip'
        task.result ??= { state: 'skip' }
        task.result.state = 'skip'
        task.result.note = _error.note
      }
      return
    }

    if (!this.onUnhandledError || this.onUnhandledError(error as any) !== false) {
      this.errorsSet.add(error)
    }
  }

  clearErrors(): void {
    this.errorsSet.clear()
  }

  getUnhandledErrors(): unknown[] {
    return Array.from(this.errorsSet.values())
  }

  addProcessTimeoutCause(cause: string): void {
    this.processTimeoutCauses.add(cause)
  }

  getProcessTimeoutCauses(): string[] {
    return Array.from(this.processTimeoutCauses.values())
  }

  getPaths(): string[] {
    return Array.from(this.pathsSet)
  }

  /**
   * Return files that were running or collected.
   */
  getFiles(keys?: string[]): File[] {
    if (keys) {
      return keys
        .map(key => this.filesMap.get(key)!)
        .flat()
        .filter(file => file && !file.local)
    }
    return Array.from(this.filesMap.values()).flat().filter(file => !file.local).sort((f1, f2) => {
      // print typecheck files first
      if (f1.meta?.typecheck && f2.meta?.typecheck) {
        return 0
      }
      if (f1.meta?.typecheck) {
        return -1
      }
      return 1
    })
  }

  getTestModules(keys?: string[]): TestModule[] {
    return this.getFiles(keys).map(file => this.getReportedEntity(file) as TestModule)
  }

  getFilepaths(): string[] {
    return Array.from(this.filesMap.keys())
  }

  getFailedFilepaths(): string[] {
    return this.getFiles()
      .filter(i => i.result?.state === 'fail')
      .map(i => i.filepath)
  }

  collectPaths(paths: string[] = []): void {
    paths.forEach((path) => {
      this.pathsSet.add(path)
    })
  }

  collectFiles(project: TestProject, files: File[] = []): void {
    files.forEach((file) => {
      const existing = this.filesMap.get(file.filepath) || []
      const otherFiles = existing.filter(
        i => i.projectName !== file.projectName || i.meta.typecheck !== file.meta.typecheck,
      )
      const currentFile = existing.find(
        i => i.projectName === file.projectName,
      )
      // keep logs for the previous file because it should always be initiated before the collections phase
      // which means that all logs are collected during the collection and not inside tests
      if (currentFile) {
        file.logs = currentFile.logs
      }
      otherFiles.push(file)
      this.filesMap.set(file.filepath, otherFiles)
      this.updateId(file, project)
    })
  }

  clearFiles(
    project: TestProject,
    paths: string[] = [],
  ): void {
    paths.forEach((path) => {
      const files = this.filesMap.get(path)
      const fileTask = createFileTask(
        path,
        project.config.root,
        project.config.name,
      )
      fileTask.local = true
      TestModule.register(fileTask, project)
      this.idMap.set(fileTask.id, fileTask)
      if (!files) {
        this.filesMap.set(path, [fileTask])
        return
      }
      const filtered = files.filter(
        file => file.projectName !== project.config.name,
      )
      // always keep a File task, so we can associate logs with it
      if (!filtered.length) {
        this.filesMap.set(path, [fileTask])
      }
      else {
        this.filesMap.set(path, [...filtered, fileTask])
      }
    })
  }

  updateId(task: Task, project: TestProject): void {
    if (this.idMap.get(task.id) === task) {
      return
    }

    if (task.type === 'suite' && 'filepath' in task) {
      TestModule.register(task, project)
    }
    else if (task.type === 'suite') {
      TestSuite.register(task, project)
    }
    else {
      TestCase.register(task, project)
    }

    this.idMap.set(task.id, task)
    if (task.type === 'suite') {
      task.tasks.forEach((task) => {
        this.updateId(task, project)
      })
    }
  }

  getReportedEntity(task: Task): TestModule | TestCase | TestSuite | undefined {
    return this.reportedTasksMap.get(task)
  }

  updateTasks(packs: TaskResultPack[]): void {
    for (const [id, result, meta] of packs) {
      const task = this.idMap.get(id)
      if (task) {
        task.result = result
        task.meta = meta
        // skipped with new PendingError
        if (result?.state === 'skip') {
          task.mode = 'skip'
        }
      }
    }
  }

  updateUserLog(log: UserConsoleLog): void {
    const task = log.taskId && this.idMap.get(log.taskId)
    if (task) {
      if (!task.logs) {
        task.logs = []
      }
      task.logs.push(log)
    }
  }

  getCountOfFailedTests(): number {
    return Array.from(this.idMap.values()).filter(
      t => t.result?.state === 'fail',
    ).length
  }

  cancelFiles(files: string[], project: TestProject): void {
    this.collectFiles(
      project,
      files.map(filepath =>
        createFileTask(filepath, project.config.root, project.config.name),
      ),
    )
  }
}
