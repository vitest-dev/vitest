import { test } from 'vitest'

test('the worker exits before sending testfileFinished', async () => {
  queueMicrotask(() => process.exit(42))
  await new Promise(() => {})
})
