import type { ErrorWithDiff, File, Task, TaskResultPack, UserConsoleLog } from '../types'
// can't import actual functions from utils, because it's incompatible with @vitest/browsers
import type { AggregateError as AggregateErrorPonyfill } from '../utils'

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

  /**
   * 根据keys获取文件集合
   * @param keys
   * @returns
   */
  getFiles(keys?: string[]): File[] {
    if (keys)
      return keys.map(key => this.filesMap.get(key)!).filter(Boolean)
    return Array.from(this.filesMap.values())
  }

  /**
   * 获取文件路径集合
   * @returns
   */
  getFilepaths(): string[] {
    return Array.from(this.filesMap.keys())
  }

  /**
   * 获取状态失败的文件路径集合
   * @returns
   */
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

  /**
   * 更新任务
   * @param packs
   * @description 写入任务结果
   */
  updateTasks(packs: TaskResultPack[]) {
    for (const [id, result] of packs) {
      if (this.idMap.has(id))
        this.idMap.get(id)!.result = result
    }
  }

  /**
   * 更新用户日志
   * @param log
   * @description 根据log中的taskId，写入到任务
   */
  updateUserLog(log: UserConsoleLog) {
    const task = log.taskId && this.idMap.get(log.taskId)
    if (task) {
      if (!task.logs)
        task.logs = []
      task.logs.push(log)
    }
  }
}
