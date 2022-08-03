import type { ErrorWithDiff, File, Task, TaskResultPack, UserConsoleLog } from '../types'
import { isAggregateError } from '../utils'

interface CollectingPromise {
  promise: Promise<void>
  resolve: () => void
}

// Note this file is shared for both node and browser, be aware to avoid node specific logic
export class StateManager {
  filesMap = new Map<string, File>()
  pathsSet: Set<string> = new Set()
  collectingPromise: CollectingPromise | undefined = undefined
  idMap = new Map<string, Task>()
  taskFileMap = new WeakMap<Task, File>()
  errorsSet = new Set<unknown>()

  catchError(err: unknown, type: string): void {
    if (isAggregateError(err))
      return err.errors.forEach(error => this.catchError(error, type));

    (err as ErrorWithDiff).type = type
    this.errorsSet.add(err)
  }

  clearErrors() {
    this.errorsSet.clear()
  }

  getUnhandledErrors() {
    return Array.from(this.errorsSet.values())
  }

  startCollectingPaths() {
    let _resolve: CollectingPromise['resolve']
    const promise = new Promise<void>((resolve) => {
      _resolve = resolve
    })
    this.collectingPromise = { promise, resolve: _resolve! }
  }

  finishCollectingPaths() {
    this.collectingPromise?.resolve()
    this.collectingPromise = undefined
  }

  async getPaths() {
    await this.collectingPromise?.promise
    return Array.from(this.pathsSet)
  }

  getFiles(keys?: string[]): File[] {
    if (keys)
      return keys.map(key => this.filesMap.get(key)!).filter(Boolean)
    return Array.from(this.filesMap.values())
  }

  getFilepaths(): string[] {
    return Array.from(this.filesMap.keys())
  }

  getFailedFilepaths() {
    return this.getFiles()
      .filter(i => i.result?.state === 'fail')
      .map(i => i.filepath)
  }

  collectPaths(paths: string[] = []) {
    paths.forEach((path) => {
      this.pathsSet.add(path)
    })
  }

  collectFiles(files: File[] = []) {
    files.forEach((file) => {
      this.filesMap.set(file.filepath, file)
      this.updateId(file)
    })
  }

  clearFiles(paths: string[] = []) {
    paths.forEach((path) => {
      this.filesMap.delete(path)
    })
  }

  updateId(task: Task) {
    if (this.idMap.get(task.id) === task)
      return
    this.idMap.set(task.id, task)
    if (task.type === 'suite') {
      task.tasks.forEach((task) => {
        this.updateId(task)
      })
    }
  }

  updateTasks(packs: TaskResultPack[]) {
    for (const [id, result] of packs) {
      if (this.idMap.has(id))
        this.idMap.get(id)!.result = result
    }
  }

  updateUserLog(log: UserConsoleLog) {
    const task = log.taskId && this.idMap.get(log.taskId)
    if (task) {
      if (!task.logs)
        task.logs = []
      task.logs.push(log)
    }
  }
}
