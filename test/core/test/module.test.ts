import { expect, it } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { a, b } from '../src/module-cjs'
import c, { d } from '../src/module-esm'
import * as timeout from '../src/timeout'

it('doesn\'t when extending module', () => {
  expect(() => Object.assign(globalThis, timeout)).not.toThrow()
})

it('should work when using cjs module', () => {
  expect(a).toBe(1)
  expect(b).toBe(2)
})

it('should work when using esm module', () => {
  expect(c).toBe(1)
  expect(d).toBe(2)
})
