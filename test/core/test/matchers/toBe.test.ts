import { stripVTControlCharacters } from 'node:util'
import { processError } from '@vitest/utils/error'
import { describe, expect, it } from 'vitest'

/**
 * Captures the error thrown by the provided function and returns a snapshot-friendly
 * object with the error message, diff, actual and expected values.
 * Part of #9074 — standardize matcher failure messages.
 */
function getError(f: () => unknown) {
  try {
    f()
  }
  catch (error) {
    const e = processError(error, { expand: true })
    return {
      message: stripVTControlCharacters(e.message),
      diff: e.diff ? stripVTControlCharacters(e.diff) : undefined,
      expected: e.expected,
      actual: e.actual,
    }
  }
  return expect.unreachable()
}

describe('toBe', () => {
  it('passes when values are strictly equal', () => {
    expect(1).toBe(1)
    expect('hello').toBe('hello')
    expect(true).toBe(true)
    expect(null).toBe(null)
    expect(undefined).toBe(undefined)
    const obj = {}
    expect(obj).toBe(obj)
  })

  it('fails with correct message when values are not strictly equal (primitives)', () => {
    expect(getError(() => expect(1).toBe(2))).toMatchInlineSnapshot(`
      {
        "actual": "1",
        "diff": "- Expected
      + Received

      - 2
      + 1",
        "expected": "2",
        "message": "expected 1 to be 2 // Object.is equality",
      }
    `)
  })

  it('fails with correct message for string mismatch', () => {
    expect(getError(() => expect('foo').toBe('bar'))).toMatchInlineSnapshot(`
      {
        "actual": "foo",
        "diff": "Expected: "bar"
      Received: "foo"",
        "expected": "bar",
        "message": "expected 'foo' to be 'bar' // Object.is equality",
      }
    `)
  })

  it('fails with correct message for boolean mismatch', () => {
    expect(getError(() => expect(true).toBe(false))).toMatchInlineSnapshot(`
      {
        "actual": "true",
        "diff": "- Expected
      + Received

      - false
      + true",
        "expected": "false",
        "message": "expected true to be false // Object.is equality",
      }
    `)
  })

  it('fails with suggestion to use toStrictEqual when objects are structurally equal', () => {
    expect(getError(() => expect({ a: 1 }).toBe({ a: 1 }))).toMatchInlineSnapshot(`
      {
        "actual": "Object {
        "a": 1,
      }",
        "diff": "Compared values have no visual difference.",
        "expected": "Object {
        "a": 1,
      }",
        "message": "expected { a: 1 } to be { a: 1 } // Object.is equality

      If it should pass with deep equality, replace "toBe" with "toStrictEqual"

      Expected: { a: 1 }
      Received: serializes to the same string
      ",
      }
    `)
  })

  it('fails with suggestion to use toEqual when arrays are deeply equal', () => {
    expect(getError(() => expect([1, 2, 3]).toBe([1, 2, 3]))).toMatchInlineSnapshot(`
      {
        "actual": "Array [
        1,
        2,
        3,
      ]",
        "diff": "Compared values have no visual difference.",
        "expected": "Array [
        1,
        2,
        3,
      ]",
        "message": "expected [ 1, 2, 3 ] to be [ 1, 2, 3 ] // Object.is equality

      If it should pass with deep equality, replace "toBe" with "toStrictEqual"

      Expected: [ 1, 2, 3 ]
      Received: serializes to the same string
      ",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect(1).not.toBe(1))).toMatchInlineSnapshot(`
      {
        "actual": "1",
        "diff": undefined,
        "expected": "1",
        "message": "expected 1 not to be 1 // Object.is equality",
      }
    `)
  })
})
