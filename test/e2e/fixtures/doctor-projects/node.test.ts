import { expect, test } from 'vitest'

// fails if the doctor environment swap leaks beyond the jsdom project
test('keeps the node environment', () => {
  expect(typeof document).toBe('undefined')
})
