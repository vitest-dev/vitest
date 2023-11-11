import { type DiffOptions, diff } from './diff'
import { format } from './display'
import { deepClone, getOwnProperties, getType } from './helpers'
import { stringify } from './stringify'

// utils is bundled for any environment and might not support `Element`
declare class Element {
  tagName: string
}

const IS_RECORD_SYMBOL = '@@__IMMUTABLE_RECORD__@@'
const IS_COLLECTION_SYMBOL = '@@__IMMUTABLE_ITERABLE__@@'

function isImmutable(v: any) {
  return v && (v[IS_COLLECTION_SYMBOL] || v[IS_RECORD_SYMBOL])
}

const OBJECT_PROTO = Object.getPrototypeOf({})

function getUnserializableMessage(err: unknown) {
  if (err instanceof Error)
    return `<unserializable>: ${err.message}`
  if (typeof err === 'string')
    return `<unserializable>: ${err}`
  return '<unserializable>'
}

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
export function serializeError(val: any, seen = new WeakMap()): any {
  if (!val || typeof val === 'string')
    return val
  if (typeof val === 'function')
    return `Function<${val.name || 'anonymous'}>`
  if (typeof val === 'symbol')
    return val.toString()
  if (typeof val !== 'object')
    return val
  // cannot serialize immutables as immutables
  if (isImmutable(val))
    return serializeError(val.toJSON(), seen)
  if (val instanceof Promise || (val.constructor && val.constructor.prototype === 'AsyncFunction'))
    return 'Promise'
  if (typeof Element !== 'undefined' && val instanceof Element)
    return val.tagName
  if (typeof val.asymmetricMatch === 'function')
    return `${val.toString()} ${format(val.sample)}`

  if (seen.has(val))
    return seen.get(val)

  if (Array.isArray(val)) {
    // eslint-disable-next-line unicorn/no-new-array -- we need to keep sparce arrays ([1,,3])
    const clone: any[] = new Array(val.length)
    seen.set(val, clone)
    val.forEach((e, i) => {
      try {
        clone[i] = serializeError(e, seen)
      }
      catch (err) {
        clone[i] = getUnserializableMessage(err)
      }
    })
    return clone
  }
  else {
    // Objects with `Error` constructors appear to cause problems during worker communication
    // using `MessagePort`, so the serialized error object is being recreated as plain object.
    const clone = Object.create(null)
    seen.set(val, clone)

    let obj = val
    while (obj && obj !== OBJECT_PROTO) {
      Object.getOwnPropertyNames(obj).forEach((key) => {
        if (key in clone)
          return
        try {
          clone[key] = serializeError(val[key], seen)
        }
        catch (err) {
          // delete in case it has a setter from prototype that might throw
          delete clone[key]
          clone[key] = getUnserializableMessage(err)
        }
      })
      obj = Object.getPrototypeOf(obj)
    }
    return clone
  }
}

function normalizeErrorMessage(message: string) {
  return message.replace(/__vite_ssr_import_\d+__\./g, '')
}

export function processError(err: any, diffOptions?: DiffOptions) {
  if (!err || typeof err !== 'object')
    return { message: err }
  // stack is not serialized in worker communication
  // we stringify it first
  if (err.stack)
    err.stackStr = String(err.stack)
  if (err.name)
    err.nameStr = String(err.name)

  if (err.showDiff || (err.showDiff === undefined && err.expected !== undefined && err.actual !== undefined)) {
    const clonedActual = deepClone(err.actual, { forceWritable: true })
    const clonedExpected = deepClone(err.expected, { forceWritable: true })

    const { replacedActual, replacedExpected } = replaceAsymmetricMatcher(clonedActual, clonedExpected)
    err.diff = diff(replacedExpected, replacedActual, { ...diffOptions, ...err.diffOptions })
  }

  if (typeof err.expected !== 'string')
    err.expected = stringify(err.expected, 10)
  if (typeof err.actual !== 'string')
    err.actual = stringify(err.actual, 10)

  // some Error implementations don't allow rewriting message
  try {
    if (typeof err.message === 'string')
      err.message = normalizeErrorMessage(err.message)

    if (typeof err.cause === 'object' && typeof err.cause.message === 'string')
      err.cause.message = normalizeErrorMessage(err.cause.message)
  }
  catch {}

  try {
    return serializeError(err)
  }
  catch (e: any) {
    return serializeError(new Error(`Failed to fully serialize error: ${e?.message}\nInner error message: ${err?.message}`))
  }
}

function isAsymmetricMatcher(data: any) {
  const type = getType(data)
  return type === 'Object' && typeof data.asymmetricMatch === 'function'
}

function isReplaceable(obj1: any, obj2: any) {
  const obj1Type = getType(obj1)
  const obj2Type = getType(obj2)
  return obj1Type === obj2Type && obj1Type === 'Object'
}

export function replaceAsymmetricMatcher(actual: any, expected: any, actualReplaced = new WeakSet(), expectedReplaced = new WeakSet()) {
  if (!isReplaceable(actual, expected))
    return { replacedActual: actual, replacedExpected: expected }
  if (actualReplaced.has(actual) || expectedReplaced.has(expected))
    return { replacedActual: actual, replacedExpected: expected }
  actualReplaced.add(actual)
  expectedReplaced.add(expected)
  getOwnProperties(expected).forEach((key) => {
    const expectedValue = expected[key]
    const actualValue = actual[key]
    if (isAsymmetricMatcher(expectedValue)) {
      if (expectedValue.asymmetricMatch(actualValue))
        actual[key] = expectedValue
    }
    else if (isAsymmetricMatcher(actualValue)) {
      if (actualValue.asymmetricMatch(expectedValue))
        expected[key] = actualValue
    }
    else if (isReplaceable(actualValue, expectedValue)) {
      const replaced = replaceAsymmetricMatcher(
        actualValue,
        expectedValue,
        actualReplaced,
        expectedReplaced,
      )
      actual[key] = replaced.replacedActual
      expected[key] = replaced.replacedExpected
    }
  })
  return {
    replacedActual: actual,
    replacedExpected: expected,
  }
}
