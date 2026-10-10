import { expect, test } from 'vitest'
import { source } from './src/unloaded'

test('a mock from the previous file does not apply', () => {
  expect(source()).toBe('original')
})
