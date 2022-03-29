import { expect } from 'vitest'

test('something has been added to global by setupFiles entry', async() => {
  // @ts-expect-error type
  const result = something
  expect(result).toBe('something')
})
