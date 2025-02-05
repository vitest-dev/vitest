import { assert, expect, test } from 'vitest'
import { two } from '../src/two.ts'

test('Math.sqrt()', () => {
  assert.equal(Math.sqrt(4), two)
  assert.equal(Math.sqrt(2), Math.SQRT2)
  expect(Math.sqrt(144)).toStrictEqual(12)
})

test('setup file works', () => {
  expect(Reflect.get(globalThis, '__TEST_SETUP_FILE__')).toBe(true)
})
