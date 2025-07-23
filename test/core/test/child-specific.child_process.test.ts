import { isMainThread, threadId } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('has access to child_process API', ({ task, skip }) => {
  skip(task.file.pool !== 'child_process', 'Run only in child_process pool')
  expect(process.send).toBeDefined()
})

test('doesn\'t have access to threads API', ({ task, skip }) => {
  skip(task.file.pool !== 'child_process', 'Run only in child_process pool')
  expect(isMainThread).toBe(true)
  expect(threadId).toBe(0)
})
