import { isMainThread } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('is run in "node:worker_threads"', () => {
  expect(isChildProcess()).toBe(false)
  expect(isMainThread).toBe(false)
})

// TODO: Use from "src/utils/base.ts" after #4441
function isChildProcess(): boolean {
  return !!process?.send
}
