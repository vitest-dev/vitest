import { expect, it } from 'vitest'
import * as exports from '../src/prototype.mjs'

it('prototype is null', () => {
  expect(Object.getPrototypeOf(exports)).toBe(null)
  expect({}.hasOwnProperty).toBeTypeOf('function')
  // eslint-disable-next-line antfu/no-cjs-exports
  expect(exports.hasOwnProperty).toBeTypeOf('undefined')
})
