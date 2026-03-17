import { isNonPlainEmptyObject, isPlainObject } from '@vitest/expect'
import { describe, expect, it } from 'vitest'

describe('isPlainObject', () => {
  it('returns true for plain object literal', () => {
    expect(isPlainObject({})).toBe(true)
  })

  it('returns true for Object.create(null)', () => {
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('returns true for object created with new Object()', () => {
    expect(isPlainObject(new Object())).toBe(true)
  })

  it('returns false for class instances', () => {
    class Foo {}
    expect(isPlainObject(new Foo())).toBe(false)
  })

  it('returns false for built-in objects like Response', () => {
    expect(isPlainObject(new Response('body', { status: 200 }))).toBe(false)
  })

  it('returns false for Date', () => {
    expect(isPlainObject(new Date())).toBe(false)
  })

  it('returns false for Map', () => {
    expect(isPlainObject(new Map())).toBe(false)
  })

  it('returns false for Set', () => {
    expect(isPlainObject(new Set())).toBe(false)
  })

  it('returns false for Array', () => {
    expect(isPlainObject([])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false)
  })

  it('returns false for primitive values', () => {
    expect(isPlainObject(42)).toBe(false)
    expect(isPlainObject('string')).toBe(false)
    expect(isPlainObject(true)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
  })
})

describe('isNonPlainEmptyObject', () => {
  it('returns true for a non-plain object with no enumerable keys', () => {
    expect(isNonPlainEmptyObject(new Response('a', { status: 200 }))).toBe(true)
  })

  it('returns true for a class instance with no enumerable keys', () => {
    class Foo {}
    expect(isNonPlainEmptyObject(new Foo())).toBe(true)
  })

  it('returns false for a plain empty object', () => {
    expect(isNonPlainEmptyObject({})).toBe(false)
  })

  it('returns false for Object.create(null)', () => {
    expect(isNonPlainEmptyObject(Object.create(null))).toBe(false)
  })

  it('returns false for a non-plain object with enumerable keys', () => {
    class Foo {
      x = 1
    }
    expect(isNonPlainEmptyObject(new Foo())).toBe(false)
  })

  it('returns false for empty arrays', () => {
    expect(isNonPlainEmptyObject([])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isNonPlainEmptyObject(null)).toBe(false)
  })

  it('returns false for primitive values', () => {
    expect(isNonPlainEmptyObject(42)).toBe(false)
    expect(isNonPlainEmptyObject('string')).toBe(false)
  })
})
