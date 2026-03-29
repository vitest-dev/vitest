import { expect, test } from 'vitest'
import { a } from './source-a'

test('a', () => {
  expect(a).toBeDefined()
})
