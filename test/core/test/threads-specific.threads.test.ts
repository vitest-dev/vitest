import { isMainThread, threadId } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('has access access to worker API', ({ task, skip }) => {
  skip(task.file.pool !== 'threads', 'Run only in child_process pool')
  expect(isMainThread).toBe(false)
  expect(threadId).toBeGreaterThan(0)
})

test('doesn\'t have access access to child_process API', ({ task, skip }) => {
  skip(task.file.pool !== 'threads', 'Run only in child_process pool')
  expect(process.send).toBeUndefined()
})
