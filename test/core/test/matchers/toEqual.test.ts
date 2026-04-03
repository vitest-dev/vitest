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

describe('toEqual', () => {
  it('passes when values are deeply equal', () => {
    expect({ a: 1 }).toEqual({ a: 1 })
    expect([1, 2, 3]).toEqual([1, 2, 3])
    expect({ a: { b: { c: 1 } } }).toEqual({ a: { b: { c: 1 } } })
    expect(new Date('2023-01-01')).toEqual(new Date('2023-01-01'))
  })

  it('fails with correct message for object mismatch', () => {
    expect(getError(() => expect({ a: 1 }).toEqual({ a: 2 }))).toMatchInlineSnapshot(`
      {
        "actual": "Object {
        "a": 1,
      }",
        "diff": "- Expected
      + Received

        {
      -   "a": 2,
      +   "a": 1,
        }",
        "expected": "Object {
        "a": 2,
      }",
        "message": "expected { a: 1 } to deeply equal { a: 2 }",
      }
    `)
  })

  it('fails with correct message for array mismatch', () => {
    expect(getError(() => expect([1, 2, 3]).toEqual([1, 2, 4]))).toMatchInlineSnapshot(`
    {
      "actual": "Array [
      1,
      2,
      3,
    ]",
      "diff": "- Expected
    + Received

      [
        1,
        2,
    -   4,
    +   3,
      ]",
      "expected": "Array [
      1,
      2,
      4,
    ]",
      "message": "expected [ 1, 2, 3 ] to deeply equal [ 1, 2, 4 ]",
    }
  `)
  })

  it('fails with correct message for primitive mismatch', () => {
    expect(getError(() => expect('foo').toEqual('bar'))).toMatchInlineSnapshot(`
          {
            "actual": "foo",
            "diff": "Expected: "bar"
          Received: "foo"",
            "expected": "bar",
            "message": "expected 'foo' to deeply equal 'bar'",
          }
        `)
  })

  it('fails with correct message for nested object mismatch', () => {
    expect(getError(() => expect({ a: { b: { c: 1 } } }).toEqual({ a: { b: { c: 2 } } }))).toMatchInlineSnapshot(`
          {
            "actual": "Object {
            "a": Object {
              "b": Object {
                "c": 1,
              },
            },
          }",
            "diff": "- Expected
          + Received

            {
              "a": {
                "b": {
          -       "c": 2,
          +       "c": 1,
                },
              },
            }",
            "expected": "Object {
            "a": Object {
              "b": Object {
                "c": 2,
              },
            },
          }",
            "message": "expected { a: { b: { c: 1 } } } to deeply equal { a: { b: { c: 2 } } }",
          }
        `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect({ a: 1 }).not.toEqual({ a: 1 }))).toMatchInlineSnapshot(`
        {
          "actual": "Object {
          "a": 1,
        }",
          "diff": "Compared values have no visual difference.",
          "expected": "Object {
          "a": 1,
        }",
          "message": "expected { a: 1 } to not deeply equal { a: 1 }",
        }
      `)
  })
})
