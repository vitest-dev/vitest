import { expect, test } from 'vitest'
import { other } from '../src/unrelated'

test('unrelated test should not run', () => {
  expect(other).toBe('unrelated')
})
