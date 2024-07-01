import { isMainThread, threadId } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('has access access to worker API', () => {
  expect(isMainThread).toBe(false)
  expect(threadId).toBeGreaterThan(0)
})

test('doesn\'t have access access to child_process API', () => {
  expect(process.send).toBeUndefined()
})
