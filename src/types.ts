export interface Task {
  name: string
  run: () => Promise<void> | void
}

export interface TaskResult {
  task: Task
  error?: unknown
}

export interface Suite {
  name: string
  test: (name: string, fn: () => Promise<void> | void) => void
  collect: () => Promise<Task[]>
}

export interface GlobalContext {
  suites: Suite[]
}
