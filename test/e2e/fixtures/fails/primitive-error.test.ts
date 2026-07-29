import { test } from 'vitest'

test('primitive error thrown', () => {
  // eslint-disable-next-line no-throw-literal
  throw 42
})
