import { isMainThread, threadId } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('has access to child_process API', () => {
  expect(process.send).toBeDefined()
})

test('doesn\'t have access to threads API', () => {
  expect(isMainThread).toBe(true)
  expect(threadId).toBe(0)
})
