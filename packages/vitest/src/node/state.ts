import type { ErrorWithDiff, File, Task, TaskResultPack, UserConsoleLog } from '../types'
import { ResultsCache } from './cache'

export class StateManager {
  filesMap = new Map<string, File>()
  idMap = new Map<string, Task>()
  taskFileMap = new WeakMap<Task, File>()
  errorsSet = new Set<unknown>()
  results = new ResultsCache()

  catchError(err: unknown, type: string) {
    (err as ErrorWithDiff).type = type
    this.errorsSet.add(err)
  }

  clearErrors() {
    this.errorsSet.clear()
  }

  getUnhandledErrors() {
    return Array.from(this.errorsSet.values())
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

  collectFiles(files: File[] = []) {
    files.forEach((file) => {
      this.filesMap.set(file.filepath, file)
      this.updateId(file)
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
