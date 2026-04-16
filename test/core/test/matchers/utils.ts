import { stripVTControlCharacters } from 'node:util'
import { processError } from '@vitest/utils/error'
import { expect } from 'vitest'

/**
 * Captures the error thrown by the provided function and returns a snapshot-friendly
 * object with the error message, diff, actual and expected values.
 * Part of #9074 — standardize matcher failure messages.
 */
export function getError(f: () => unknown) {
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
