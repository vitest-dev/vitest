import im from 'immutable'
import { expect, test } from 'vitest'

test('basic', () => {
  expect(im.List([{ x: 1 }])).toEqual(im.List([{ x: 1 }]))
  expect(im.List([{ x: 1 }])).toEqual(im.List([1]).map(i => ({ x: i })))
  expect(im.List([{ x: 1 }])).not.toEqual(im.List([{ x: 2 }]))
  expect(im.List([{ x: 1 }])).not.toEqual(im.List([]))
})
