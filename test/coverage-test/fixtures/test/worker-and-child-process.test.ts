import { expect, test } from 'vitest'
// @ts-expect-error -- untyped
import { inWorker } from '../src/worker-and-process.js'
import { runFork } from '../src/start-fork-and-thread'

test('same file in worker and child process', async () => {
  expect(inWorker()).toBe('b')

  const { result } = await runFork('worker-and-process.child.js')
  expect(result).toBe('child')
})
