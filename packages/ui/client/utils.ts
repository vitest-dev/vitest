import type { File, RunMode, Suite, Task, TaskState, Test } from 'vitest'

type TaskMap = Map<string, Task>

const buildMap = (task: Task, taskMap: TaskMap): void => {
  if (task.id)
    taskMap.set(task.id, task)

  if (task.type === 'suite')
    task.tasks.filter(x => typeof x === 'object').forEach(t => buildMap(t, taskMap))

  if (task.suite)
    buildMap(task.suite, taskMap)
}

const restoreTaskFromId = (task: Task, taskMap: TaskMap): void => {
  if (task.type === 'suite') {
    task.tasks = task.tasks.map((x) => {
      if (typeof x === 'string')
        return taskMap.get(x)

      restoreTaskFromId(x, taskMap)
      return x
    }) as Task[]
  }
}

export const restoreTestFileStructure = (file: File): File => {
  const taskMap = new Map<string, Task>()
  const output = { ...file }
  buildMap(output, taskMap)
  restoreTaskFromId(output, taskMap)

  return output
}

export type TaskUI = {
  id: string
  type: string
  name: string
  mode: RunMode
  duration: number
  state?: TaskState
  tasks?: TaskUI[]
}

export type FileUI = {
  id: string
  name: string
  tasks: TaskUI[]
}

export const pickTasksFromFile = (file: File): FileUI => {
  const transformTask = (task: Suite | Test): TaskUI => {
    const output: TaskUI = {
      type: task.type,
      id: task.id,
      name: task.name,
      mode: task.mode,
      duration: 0,
    }

    if (task.mode === 'run' || task.mode === 'only') {
      output.duration = Math.round(task.result!.end! - task.result!.start)
      output.state = task.result!.state
    }

    if (task.type === 'suite')
      output.tasks = task.tasks.map(transformTask)

    return output
  }

  return {
    id: file.id,
    name: file.name,
    tasks: file.tasks.map(transformTask),
  }
}
