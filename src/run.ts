import { Suite, TaskResult } from './types'

// TODO: hooks
export async function run(suite: Suite) {
  const results: TaskResult[] = []

  const queue = await suite.collect()
  for (const task of queue) {
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
