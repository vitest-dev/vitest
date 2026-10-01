import { test } from 'vitest'

test('the worker dies before sending testfileFinished', async () => {
  // SIGINT the worker process so it can't send testfileFinished back to main.
  // Pre-fix this caused pool.run() to hang forever instead of rejecting.
  queueMicrotask(() => process.kill(process.pid, 'SIGINT'))
  await new Promise(() => {})
})
