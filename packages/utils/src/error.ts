import type { DiffOptions, StringifiedMemory } from './diff'
import type { TestError } from './types'
import { format as prettyFormat } from '@vitest/pretty-format'
import { getDefaultFormatOptions, printDiffOrStringify } from './diff'
import { serializeValue } from './serialize'

export { serializeValue as serializeError }

export function processError(
  _err: any,
  diffOptions?: DiffOptions,
  seen: WeakSet<WeakKey> = new WeakSet(),
): TestError {
  if (!_err || typeof _err !== 'object') {
    return { message: String(_err) }
  }
  const err = _err as TestError

  if (
    err.showDiff
    || (err.showDiff === undefined
      && err.expected !== undefined
      && err.actual !== undefined)
  ) {
    const memory: StringifiedMemory = {}
    const options = {
      ...diffOptions,
      ...err.diffOptions as DiffOptions,
    }
    err.diff = printDiffOrStringify(
      err.actual,
      err.expected,
      options,
      memory,
    )

    // TODO: simplify if/else
    if ('expected' in memory) {
      err.expected = memory.expected
    }
    else if (typeof err.expected !== 'string') {
      err.expected = prettyFormat(err.expected, getDefaultFormatOptions(options))
    }

    if ('actual' in memory) {
      err.actual = memory.actual
    }
    else if (typeof err.actual !== 'string') {
      err.actual = prettyFormat(err.actual, getDefaultFormatOptions(options))
    }
  }

  // some Error implementations may not allow rewriting cause
  // in most cases, the assignment will lead to "err.cause = err.cause"
  try {
    if (!seen.has(err) && typeof err.cause === 'object') {
      seen.add(err)
      err.cause = processError(err.cause, diffOptions, seen)
    }
  }
  catch {}

  try {
    return serializeValue(err)
  }
  catch (e: any) {
    return serializeValue(
      new Error(
        `Failed to fully serialize error: ${e?.message}\nInner error message: ${err?.message}`,
      ),
    )
  }
}
