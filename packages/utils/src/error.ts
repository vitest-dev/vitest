import type { DiffOptions } from './diff'
import type { TestError } from './types'
import { printDiffOrStringify } from './diff'
import { stringify } from './display'
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
    err.diff = printDiffOrStringify(err.actual, err.expected, {
      ...diffOptions,
      ...err.diffOptions as DiffOptions,
    })
  }

  if ('expected' in err && typeof err.expected !== 'string') {
    err.expected = stringify(err.expected, 10)
  }
  if ('actual' in err && typeof err.actual !== 'string') {
    err.actual = stringify(err.actual, 10)
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
