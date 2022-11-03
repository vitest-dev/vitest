import util from 'util'
import { util as ChaiUtil } from 'chai'
import { stringify } from '../integrations/chai/jest-matcher-utils'
import { deepClone, getType } from '../utils'

const IS_RECORD_SYMBOL = '@@__IMMUTABLE_RECORD__@@'
const IS_COLLECTION_SYMBOL = '@@__IMMUTABLE_ITERABLE__@@'

const isImmutable = (v: any) => v && (v[IS_COLLECTION_SYMBOL] || v[IS_RECORD_SYMBOL])

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
    return `Function<${val.name}>`
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
    return `${val.toString()} ${util.format(val.sample)}`

  if (seen.has(val))
    return seen.get(val)

  if (Array.isArray(val)) {
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

export function processError(err: any) {
  if (!err || typeof err !== 'object')
    return err
  // stack is not serialized in worker communication
  // we stringify it first
  if (err.stack)
    err.stackStr = String(err.stack)
  if (err.name)
    err.nameStr = String(err.name)

  const clonedActual = deepClone(err.actual)
  const clonedExpected = deepClone(err.expected)

  const { replacedActual, replacedExpected } = replaceAsymmetricMatcher(clonedActual, clonedExpected)

  err.actual = replacedActual
  err.expected = replacedExpected

  if (typeof err.expected !== 'string')
    err.expected = stringify(err.expected)
  if (typeof err.actual !== 'string')
    err.actual = stringify(err.actual)

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

export function replaceAsymmetricMatcher(actual: any, expected: any, actualReplaced = new WeakMap(), expectedReplaced = new WeakMap()) {
  if (!isReplaceable(actual, expected))
    return { replacedActual: actual, replacedExpected: expected }
  if (actualReplaced.has(actual) || expectedReplaced.has(expected))
    return { replacedActual: actual, replacedExpected: expected }
  actualReplaced.set(actual, true)
  expectedReplaced.set(expected, true)
  ChaiUtil.getOwnEnumerableProperties(expected).forEach((key) => {
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
