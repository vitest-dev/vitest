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

  if ('expected' in err) {
    err.expected = removeUndefined(err.expected)
  }
  if ('actual' in err) {
    err.actual = removeUndefined(err.actual)
  }

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

function removeUndefined<T>(
  val: T,
  customHandler: CustomHandler = handleNativeObjects,
): T {
  const seen = new WeakMap<object, unknown>()

  function innerRemove(val: unknown): unknown {
    // Use custom handler first
    const custom = customHandler(val)
    if (custom !== undefined) {
      return custom
    }

    // Primitive or null
    if (val === null || typeof val !== 'object') {
      return val
    }

    // Circular reference check
    if (seen.has(val as object)) {
      return seen.get(val as object)
    }

    // Handle arrays
    if (Array.isArray(val)) {
      const out: unknown[] = []
      seen.set(val, out)
      for (let i = 0; i < val.length; i++) {
        out[i] = innerRemove(val[i])
      }
      return out
    }

    // Handle plain objects and class instances
    const proto = Object.getPrototypeOf(val)
    const out = Object.create(proto)
    seen.set(val as object, out)

    const keys = [
      ...Object.getOwnPropertyNames(val),
      ...Object.getOwnPropertySymbols(val),
    ]

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(val, key)
      if (!descriptor) {
        continue
      }

      // Evaluate getter if exists
      const value
        = 'get' in descriptor && typeof descriptor.get === 'function'
          ? (val as any)[key]
          : descriptor.value

      if (value === undefined) {
        continue
      }

      const cloned = innerRemove(value)

      if ('get' in descriptor && typeof descriptor.get === 'function') {
        Object.defineProperty(out, key, {
          ...descriptor,
          get() {
            return cloned
          },
        })
      }
      else {
        Object.defineProperty(out, key, {
          ...descriptor,
          value: cloned,
        })
      }
    }

    return out
  }

  return innerRemove(val) as T
}

// Heuristic logic
type CustomHandler = (val: unknown) => unknown | undefined

// Default handler for native objects
function handleNativeObjects(val: unknown): unknown | undefined {
  // If given value is specific native object, return it as is
  if (
    val instanceof RegExp
    || val instanceof Date
    || val instanceof Map
    || val instanceof Set
    || val instanceof Error
    || val instanceof URL
  ) {
    return val
  }
  return undefined
}
