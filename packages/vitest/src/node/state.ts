import type { File, Task, TaskResultPack, UserConsoleLog } from '../types'

export class StateManager {
  // paths is used for the web integration
  pathsSet: Set<string> = new Set()
  filesMap = new Map<string, File>()
  idMap = new Map<string, Task>()
  taskFileMap = new WeakMap<Task, File>()

  getPaths() {
    console.log('getPaths', this.pathsSet)
    return Array.from(this.pathsSet)
  }

  getFiles(keys?: string[]): File[] {
    if (keys)
      return keys.map(key => this.filesMap.get(key)!)
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
    console.log('collectPaths', this.pathsSet)
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
