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

describe('toBeGreaterThan', () => {
  it('passes when actual is greater than expected', () => {
    expect(2).toBeGreaterThan(1)
    expect(0).toBeGreaterThan(-1)
    expect(BigInt(5)).toBeGreaterThan(BigInt(3))
  })

  it('fails with correct message when actual is not greater than expected', () => {
    expect(getError(() => expect(1).toBeGreaterThan(2))).toMatchInlineSnapshot(`
      {
        "actual": "1",
        "diff": undefined,
        "expected": "2",
        "message": "expected 1 to be greater than 2",
      }
    `)
  })

  it('fails with correct message when actual equals expected', () => {
    expect(getError(() => expect(2).toBeGreaterThan(2))).toMatchInlineSnapshot(`
      {
        "actual": "2",
        "diff": undefined,
        "expected": "2",
        "message": "expected 2 to be greater than 2",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect(5).not.toBeGreaterThan(3))).toMatchInlineSnapshot(`
      {
        "actual": "5",
        "diff": undefined,
        "expected": "3",
        "message": "expected 5 to be not greater than 3",
      }
    `)
  })
})

describe('toBeGreaterThanOrEqual', () => {
  it('passes when actual is greater than or equal to expected', () => {
    expect(2).toBeGreaterThanOrEqual(1)
    expect(2).toBeGreaterThanOrEqual(2)
    expect(BigInt(5)).toBeGreaterThanOrEqual(BigInt(5))
  })

  it('fails with correct message when actual is less than expected', () => {
    expect(getError(() => expect(1).toBeGreaterThanOrEqual(2))).toMatchInlineSnapshot(`
      {
        "actual": "1",
        "diff": undefined,
        "expected": "2",
        "message": "expected 1 to be greater than or equal to 2",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect(5).not.toBeGreaterThanOrEqual(5))).toMatchInlineSnapshot(`
      {
        "actual": "5",
        "diff": undefined,
        "expected": "5",
        "message": "expected 5 to be not greater than or equal to 5",
      }
    `)
  })
})

describe('toBeLessThan', () => {
  it('passes when actual is less than expected', () => {
    expect(1).toBeLessThan(2)
    expect(-1).toBeLessThan(0)
    expect(BigInt(3)).toBeLessThan(BigInt(5))
  })

  it('fails with correct message when actual is not less than expected', () => {
    expect(getError(() => expect(2).toBeLessThan(1))).toMatchInlineSnapshot(`
      {
        "actual": "2",
        "diff": undefined,
        "expected": "1",
        "message": "expected 2 to be less than 1",
      }
    `)
  })

  it('fails with correct message when actual equals expected', () => {
    expect(getError(() => expect(2).toBeLessThan(2))).toMatchInlineSnapshot(`
      {
        "actual": "2",
        "diff": undefined,
        "expected": "2",
        "message": "expected 2 to be less than 2",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect(1).not.toBeLessThan(5))).toMatchInlineSnapshot(`
      {
        "actual": "1",
        "diff": undefined,
        "expected": "5",
        "message": "expected 1 to be not less than 5",
      }
    `)
  })
})

describe('toBeLessThanOrEqual', () => {
  it('passes when actual is less than or equal to expected', () => {
    expect(1).toBeLessThanOrEqual(2)
    expect(2).toBeLessThanOrEqual(2)
    expect(BigInt(3)).toBeLessThanOrEqual(BigInt(5))
  })

  it('fails with correct message when actual is greater than expected', () => {
    expect(getError(() => expect(3).toBeLessThanOrEqual(2))).toMatchInlineSnapshot(`
      {
        "actual": "3",
        "diff": undefined,
        "expected": "2",
        "message": "expected 3 to be less than or equal to 2",
      }
    `)
  })

  it('fails with negation message', () => {
    expect(getError(() => expect(2).not.toBeLessThanOrEqual(5))).toMatchInlineSnapshot(`
      {
        "actual": "2",
        "diff": undefined,
        "expected": "5",
        "message": "expected 2 to be not less than or equal to 5",
      }
    `)
  })
})
