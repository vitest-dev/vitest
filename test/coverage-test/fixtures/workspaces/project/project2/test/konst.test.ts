import { expect, test } from 'vitest'
import { konst } from '../src/konst'

test('returns function that returns constant value', () => {
  const fn = konst(1)

  expect(fn()).toBe(1);
})
