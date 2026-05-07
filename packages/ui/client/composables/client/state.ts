import type { TestError } from '@vitest/utils'
import type {
  RunnerTask,
  RunnerTaskResultPack,
  RunnerTestFile,
  TestTagDefinition,
  UserConsoleLog,
} from 'vitest'
import type { Ref } from 'vue'
import type { RunState } from '../../../types'
import { createFileTask } from '@vitest/runner/utils'
import { computed, ref } from 'vue'
import { config } from '.'

export const testRunState: Ref<RunState> = ref('idle')
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<TestError[]> = ref([])
export const tagsDefinitions = computed(() => {
  const tags = config.value.tags || []
  return tags.reduce((acc, tag) => {
    acc[tag.name] = tag
    return acc
  }, {} as Record<string, TestTagDefinition>)
})

export class StateManager {
  filesMap: Map<string, RunnerTestFile[]> = new Map()
  pathsSet: Set<string> = new Set()
  idMap: Map<string, RunnerTask> = new Map()

  getPaths(): string[] {
    return Array.from(this.pathsSet)
  }

  /**
   * Return files that were running or collected.
   */
  getFiles(keys?: string[]): RunnerTestFile[] {
    if (keys) {
      return keys
        .map(key => this.filesMap.get(key)!)
        .flat()
        .filter(file => file && !file.local)
    }
    return Array.from(this.filesMap.values()).flat().filter(file => !file.local)
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

  collectFiles(files: RunnerTestFile[] = []): void {
    files.forEach((file) => {
      const existing = this.filesMap.get(file.filepath) || []
      const otherProject = existing.filter(
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
      otherProject.push(file)
      this.filesMap.set(file.filepath, otherProject)
      this.updateId(file)
    })
  }

  // this file is reused by ws-client, and should not rely on heavy dependencies like workspace
  clearFiles(
    _project: { config: { name: string | undefined; root: string } },
    paths: string[] = [],
  ): void {
    const project = _project
    paths.forEach((path) => {
      const files = this.filesMap.get(path)
      const fileTask = createFileTask(
        path,
        project.config.root,
        project.config.name || '',
      )
      fileTask.local = true
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

  updateId(task: RunnerTask): void {
    if (this.idMap.get(task.id) === task) {
      return
    }
    this.idMap.set(task.id, task)
    if (task.type === 'suite') {
      task.tasks.forEach((task) => {
        this.updateId(task)
      })
    }
  }

  updateTasks(packs: RunnerTaskResultPack[]): void {
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
}
