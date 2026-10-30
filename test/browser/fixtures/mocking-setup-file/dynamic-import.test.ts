import { expect, test } from 'vitest'

test('a dynamic import gets the mock from the setup file', async () => {
  const { answer } = await import('./source')
  expect(answer()).toBe('mocked')
})
