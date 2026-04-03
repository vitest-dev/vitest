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

describe('toContain', () => {
  it('passes when array contains element', () => {
    expect([1, 2, 3]).toContain(2)
    expect(['a', 'b', 'c']).toContain('b')
  })

  it('passes when string contains substring', () => {
    expect('hello world').toContain('world')
    expect('foobar').toContain('oo')
  })

  it('fails with correct message when array does not contain element', () => {
    expect(getError(() => expect([1, 2, 3]).toContain(4))).toMatchInlineSnapshot(`
      {
        "actual": "Array [
        1,
        2,
        3,
      ]",
        "diff": undefined,
        "expected": "undefined",
        "message": "expected [ 1, 2, 3 ] to include 4",
      }
    `)
  })

  it('fails with correct message when string does not contain substring', () => {
    expect(getError(() => expect('hello world').toContain('xyz'))).toMatchInlineSnapshot(`
    {
      "actual": "hello world",
      "diff": "Expected: "xyz"
    Received: "hello world"",
      "expected": "xyz",
      "message": "expected 'hello world' to contain 'xyz'",
    }
  `)
  })

  it('fails with negation message when array contains element', () => {
    expect(getError(() => expect([1, 2, 3]).not.toContain(2))).toMatchInlineSnapshot(`
    {
      "actual": "Array [
      1,
      2,
      3,
    ]",
      "diff": undefined,
      "expected": "undefined",
      "message": "expected [ 1, 2, 3 ] to not include 2",
    }
  `)
  })

  it('fails with negation message when string contains substring', () => {
    expect(getError(() => expect('hello world').not.toContain('world'))).toMatchInlineSnapshot(`
          {
            "actual": "hello world",
            "diff": "Expected: "world"
          Received: "hello world"",
            "expected": "world",
            "message": "expected 'hello world' not to contain 'world'",
          }
        `)
  })
})
