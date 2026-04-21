import { test } from 'vitest';

interface _Unused {
  _fake: never
}

test('unhandled exception', async () => {
  ;(async () => {
    throw new Error('custom_unhandled_error')
  })()
  // trigger the error during the test so the report includes the helpful message
  // in reality, most tests will have something going on here already
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 50))
})
