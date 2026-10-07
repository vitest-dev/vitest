import { expect, test } from 'vitest'
import { answer } from './source'

test('a static import gets the mock from the setup file', () => {
  expect(answer()).toBe('mocked')
})
