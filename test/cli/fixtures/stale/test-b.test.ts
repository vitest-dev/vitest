import { expect, test } from 'vitest'
import { b } from './source-b'

test('b', () => {
  expect(b).toBeDefined()
})
