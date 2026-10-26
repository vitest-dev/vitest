import { expect, test } from 'vitest'
import { unloaded } from '../src/unloaded'

test('a mock that no file imported does not apply', () => {
  expect(unloaded()).toBe('original')
})
