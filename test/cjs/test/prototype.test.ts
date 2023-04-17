import { expect, it } from 'vitest'
import * as cjsExports from '../src/prototype.cjs'

it('has object prototype', () => {
  expect(cjsExports.getPrototype()).toBe(Object.prototype)
  expect(() => cjsExports.test()).not.toThrow()
  expect(cjsExports.test()).toBe(true)
})
