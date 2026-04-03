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

describe('toHaveLength', () => {
  it('passes for arrays with correct length', () => {
    expect([1, 2, 3]).toHaveLength(3)
    expect([]).toHaveLength(0)
  })

  it('passes for strings with correct length', () => {
    expect('hello').toHaveLength(5)
    expect('').toHaveLength(0)
  })

  it('passes for objects with length property', () => {
    expect({ length: 5 }).toHaveLength(5)
  })

  it('fails with correct message for array length mismatch', () => {
    expect(getError(() => expect([1, 2, 3]).toHaveLength(5))).toMatchInlineSnapshot(`
      {
        "actual": "3",
        "diff": "- Expected
      + Received

      - 5
      + 3",
        "expected": "5",
        "message": "expected [ 1, 2, 3 ] to have a length of 5 but got 3",
      }
    `)
  })

  it('fails with correct message for string length mismatch', () => {
    expect(getError(() => expect('hello').toHaveLength(3))).toMatchInlineSnapshot(`
      {
        "actual": "5",
        "diff": "- Expected
      + Received

      - 3
      + 5",
        "expected": "3",
        "message": "expected 'hello' to have a length of 3 but got 5",
      }
    `)
  })

  it('fails with correct message for empty array when length is expected to be non-zero', () => {
    expect(getError(() => expect([]).toHaveLength(1))).toMatchInlineSnapshot(`
      {
        "actual": "0",
        "diff": "- Expected
      + Received

      - 1
      + 0",
        "expected": "1",
        "message": "expected [] to have a length of 1 but got +0",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect([1, 2, 3]).not.toHaveLength(3))).toMatchInlineSnapshot(`
      {
        "actual": "3",
        "diff": undefined,
        "expected": "3",
        "message": "expected [ 1, 2, 3 ] to not have a length of 3",
      }
    `)
  })
})
