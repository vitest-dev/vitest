import { describe, expect, it } from 'vitest'

// @ts-expect-error is not typed with imports
import * as arrayCjs from '../src/cjs/array-cjs'

// @ts-expect-error is not typed with imports
import bareCjs, { a as bareA, b as bareB } from '../src/cjs/bare-cjs'

// @ts-expect-error is not typed with imports
import * as classCjs from '../src/cjs/class-cjs'

import format from '../src/cjs/default-function'

// @ts-expect-error is not typed
import cjs, { a, b } from '../src/cjs/module-cjs'

// @ts-expect-error is not typed with imports
import * as nestedDefaultCjs from '../src/cjs/nested-default-cjs'

// @ts-expect-error is not typed with imports
import primitiveCjs, { a as primitiveA } from '../src/cjs/primitive-cjs'

// @ts-expect-error is not typed with imports
import * as primitiveAll from '../src/cjs/primitive-cjs'

// @ts-expect-error is not typed with imports
import * as prototypeCjs from '../src/cjs/prototype-cjs'

// @ts-expect-error is not typed with imports
import * as prototypeEsm from '../src/esm/esm.js'

// @ts-expect-error is not typed with imports
import * as internalEsm from '../src/esm/internal-esm.mjs'

// @ts-expect-error is not typed with imports
import * as moduleDefaultCjs from '../src/external/default-cjs'

// @ts-expect-error is not typed with imports
import * as nestedDefaultExternalCjs from '../src/external/nested-default-cjs'

import c, { d } from '../src/module-esm'
import * as timeout from '../src/timeout'

it('doesn\'t when extending module', () => {
  expect(() => Object.assign(globalThis, timeout)).not.toThrow()
})

describe('validating nested defaults in isolation', () => {
  it.each([
    nestedDefaultCjs,
    nestedDefaultExternalCjs,
  ])('nested default should be resolved', (mod) => {
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

it('cjs has object prototype', () => {
  expect(prototypeCjs.getPrototype()).toBe(Object.prototype)
  expect(() => prototypeCjs.test()).not.toThrow()
  expect(prototypeCjs.test()).toBe(true)
})

it('esm prototype is null', () => {
  expect(Object.getPrototypeOf(prototypeEsm)).toBe(null)
  expect({}.hasOwnProperty).toBeTypeOf('function')

  expect(prototypeEsm.hasOwnProperty).toBeTypeOf('undefined')
})

describe('correctly puts default on default', () => {
  it('works on default function', () => {
    expect(format()).toBe('')
  })

  it('works on nested default function', () => {
    // @ts-expect-error types defined only default
    expect(format.default).toBeUndefined()
  })
})
