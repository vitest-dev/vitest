import { __assign } from 'tslib'
import { parse } from 'css-what'
import { expect, test } from 'vitest'

test('imported libs have incorrect ESM, but still work', () => {
  expect(__assign({}, { a: 1 })).toEqual({ a: 1 })
  expect(parse('a')).toBeDefined()
})
