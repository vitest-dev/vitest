import { describe, expect, it } from 'vitest'
import { getWorkerState } from 'vitest/src/utils'
// @ts-expect-error is not typed
import cjs, { a, b } from '../src/cjs/module-cjs'
// @ts-expect-error is not typed with imports
import bareCjs, { a as bareA, b as bareB } from '../src/cjs/bare-cjs'
// @ts-expect-error is not typed with imports
import primitiveCjs, { a as primitiveA } from '../src/cjs/primitive-cjs'
// @ts-expect-error is not typed with imports
import * as primitiveAll from '../src/cjs/primitive-cjs'
// @ts-expect-error is not typed with imports
import * as arrayCjs from '../src/cjs/array-cjs'
// @ts-expect-error is not typed with imports
import * as classCjs from '../src/cjs/class-cjs'
// @ts-expect-error is not typed with imports
import * as nestedDefaultCjs from '../src/cjs/nested-default-cjs'
// @ts-expect-error is not typed with imports
import * as nestedDefaultExternalCjs from '../src/external/nested-default-cjs'
// @ts-expect-error is not typed with imports
import * as moduleDefaultCjs from '../src/external/default-cjs'
// @ts-expect-error is not typed with imports
import * as internalEsm from '../src/esm/internal-esm.mjs'
import c, { d } from '../src/module-esm'
import * as timeout from '../src/timeout'

it('doesn\'t when extending module', () => {
  expect(() => Object.assign(globalThis, timeout)).not.toThrow()
})

const config = getWorkerState().config

// don't run with threads disabled, because we don't clean "external" cache
describe.runIf(config.threads)('validating nested defaults in isolation', () => {
  it.each([
    nestedDefaultCjs,
    nestedDefaultExternalCjs,
  ])('nested default should stay, because environment is node', (mod) => {
    expect(mod).toHaveProperty('default')
    expect(mod.default).toHaveProperty('default')
    expect(mod.default.default.a).toBe('a')
    expect(mod.default.default.b).toBe('b')
  })

  it('don\'t interop external module.exports, because environment is node', () => {
    expect(moduleDefaultCjs).toHaveProperty('default')
    expect(moduleDefaultCjs.default).toHaveProperty('a')
    expect(moduleDefaultCjs).not.toHaveProperty('a')
  })
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

it('arrays-cjs', () => {
  expect(arrayCjs.default).toEqual([1, '2'])
  expect(arrayCjs).not.toHaveProperty('0')
})

it('class-cjs', () => {
  expect(classCjs.default).toEqual({ variable: 1, Test: expect.any(Function) })
  expect(classCjs.default).toBeInstanceOf(classCjs.Test)
  expect(classCjs, 'for compat with ESM it also defines props on Module').toHaveProperty('variable')
})

it('should work when using esm module', () => {
  expect(c).toBe(1)
  expect(d).toBe(2)
})

it('exports all from native ESM module', () => {
  expect(internalEsm).toHaveProperty('restoreAll')
})
