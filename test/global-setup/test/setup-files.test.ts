import { expect, test } from 'vitest'

test('something has been added to global by setupFiles entry', async () => {
  // @ts-expect-error type
  const result = something
  expect(result).toBe('something')
})

test('setup file has been loaded without relative path prefix', () => {
  // @ts-expect-error type
  const result = loaded
  expect(result).toBeTruthy()
})
