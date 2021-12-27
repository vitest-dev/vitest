import type { File, RunMode, Suite, TaskState, Test } from 'vitest'

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
