import { test } from 'vitest'

test('the worker exits before sending testfileFinished', async () => {
  // @ts-expect-error -- use reallyExit as Vitest patches process.exit
  queueMicrotask(() => process.reallyExit(42))
  await new Promise(() => {})
})
