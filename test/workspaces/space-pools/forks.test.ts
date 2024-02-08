import { isMainThread } from 'node:worker_threads'
import { expect, test } from 'vitest'

test('is run in "node:child_process"', () => {
  expect(isChildProcess()).toBe(true)
  expect(isMainThread).toBe(true)
})

// TODO: Use from "src/utils/base.ts" after #4441
function isChildProcess(): boolean {
  return !!process?.send
}
