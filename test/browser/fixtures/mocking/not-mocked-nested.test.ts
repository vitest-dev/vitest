import { expect, test } from 'vitest'
import { parent } from './src/nested_parent'

test('adds', () => {
  expect(parent()).toBe(true)
})
