/**
 * @vitest-environment jsdom
 */

import { expect, it } from 'vitest'
// @ts-expect-error is not typed with imports
import * as nestedDefaultCjs from '../src/cjs/nested-default-cjs'
// @ts-expect-error is not typed with imports
import * as nestedDefaultExternalCjs from '../src/external/nested-default-cjs'
// @ts-expect-error is not typed with imports
import * as moduleDefaultCjs from '../src/external/default-cjs'

it.each([
  nestedDefaultCjs,
  nestedDefaultExternalCjs,
])('nested default should be resolved, because environment is not node', (mod) => {
  expect(mod).toHaveProperty('default')
  expect(mod.default).not.toHaveProperty('default')
  expect(mod.default.a).toBe('a')
  expect(mod.default.b).toBe('b')
  expect(mod.a).toBe('a')
  expect(mod.b).toBe('b')
})

it('externalized "module.exports" CJS module interops default', () => {
  expect(moduleDefaultCjs).toHaveProperty('default')
  expect(moduleDefaultCjs.default).toHaveProperty('a')
  expect(moduleDefaultCjs.default.a).toBe('a')
  expect(moduleDefaultCjs).toHaveProperty('a')
  expect(moduleDefaultCjs.a).toBe('a')
})
