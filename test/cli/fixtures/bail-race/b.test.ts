import { test } from 'vitest'

test('does not run', () => {
  throw new Error("Should never run")
})
