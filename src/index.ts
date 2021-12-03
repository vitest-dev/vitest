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
  queue: Task[]
}

export interface GlobalContext {
  suites: Suite[]
}

export const context: GlobalContext = {
  suites: [],
}

export function suite(suiteName: string) {
  const queue: Task[] = []

  function test(name: string, run: () => Promise<void> | void) {
    const task: Task = {
      name,
      run,
    }
    queue.push(task)
  }

  const suite: Suite = {
    name: suiteName,
    test,
    queue,
  }

  context.suites.push(suite)

  return suite
}

// TODO: hooks
export async function run(suite: Suite) {
  const results: TaskResult[] = []

  for (const task of suite.queue) {
    const result: TaskResult = { task }
    try {
      await task.run()
    }
    catch (e) {
      result.error = e
    }
    results.push(result)
  }

  return results
}

export const defaultSuite = suite('')
export const test = defaultSuite.test
