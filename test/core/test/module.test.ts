import { expect, it } from 'vitest'
// @ts-expect-error is not typed
import cjs, { a, b } from '../src/cjs/module-cjs'
// @ts-expect-error is not typed with imports
import bareCjs, { a as bareA, b as bareB } from '../src/cjs/bare-cjs'
// @ts-expect-error is not typed with imports
import primitiveCjs, { a as primitiveA } from '../src/cjs/primitive-cjs'
// @ts-expect-error is not typed with imports
import * as primitiveAll from '../src/cjs/primitive-cjs'
import c, { d } from '../src/module-esm'
import * as timeout from '../src/timeout'

it('doesn\'t when extending module', () => {
  expect(() => Object.assign(globalThis, timeout)).not.toThrow()
})

it('should work when using module.exports cjs', () => {
  expect(cjs.a).toBe(1)
  expect(cjs.b).toBe(2)
  expect(a).toBe(1)
  expect(b).toBe(2)
})

it('works with bare exports cjs', () => {
  expect(bareCjs.a).toBe('a')
  expect(bareCjs.b).toBe('b')
  expect(bareCjs.c).toBe('c')
  expect(bareA).toBe('a')
  expect(bareB).toBe('b')
})

it('primitive cjs retains its logic', () => {
  expect(primitiveA).toBeUndefined()
  expect(primitiveCjs).toBe('string')
  expect(primitiveAll.default).toBe('string')
  expect(primitiveAll, 'doesn\'t put chars from "string" on exports').not.toHaveProperty('0')
})

it('should work when using esm module', () => {
  expect(c).toBe(1)
  expect(d).toBe(2)
})
