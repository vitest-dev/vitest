import { expect, test } from 'vitest'
import { consumer } from '../src/consumer'

test('a new module links to the mock of an earlier file', () => {
  expect(consumer()).toBe('original')
})
