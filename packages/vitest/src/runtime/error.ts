import { format } from 'util'
import { util } from 'chai'
import { stringify } from '../integrations/chai/jest-matcher-utils'
import { clone, getType } from '../utils'

const OBJECT_PROTO = Object.getPrototypeOf({})

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
export function serializeError(val: any, seen = new WeakMap()): any {
  if (!val || typeof val === 'string')
    return val
  if (typeof val === 'function')
    return `Function<${val.name}>`
  if (typeof val !== 'object')
    return val
  if (val instanceof Promise || 'then' in val || (val.constructor && val.constructor.prototype === 'AsyncFunction'))
    return 'Promise'
  if (typeof Element !== 'undefined' && val instanceof Element)
    return val.tagName
  if (typeof val.asymmetricMatch === 'function')
    return `${val.toString()} ${format(val.sample)}`

  if (seen.has(val))
    return seen.get(val)

  if (Array.isArray(val)) {
    const clone: any[] = new Array(val.length)
    seen.set(val, clone)
    val.forEach((e, i) => {
      clone[i] = serializeError(e, seen)
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
        if (!(key in clone))
          clone[key] = serializeError(obj[key], seen)
      })
      obj = Object.getPrototypeOf(obj)
    }
    return clone
  }
}

export function processError(err: any) {
  if (!err)
    return err
  // stack is not serialized in worker communication
  // we stringify it first
  if (err.stack)
    err.stackStr = String(err.stack)
  if (err.name)
    err.nameStr = String(err.name)

  const clonedActual = clone(err.actual)
  const clonedExpected = clone(err.expected)

  const { replacedActual, replacedExpected } = replaceAsymmetricMatcher(clonedActual, clonedExpected)

  err.actual = replacedActual
  err.expected = replacedExpected

  if (typeof err.expected !== 'string')
    err.expected = stringify(err.expected)
  if (typeof err.actual !== 'string')
    err.actual = stringify(err.actual)
  try {
    return serializeError(err)
  }
  catch (e: any) {
    return serializeError(new Error(`Failed to fully serialize error: ${e?.message}.\nInner error message: ${err?.message}`))
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

export function replaceAsymmetricMatcher(actual: any, expected: any) {
  if (!isReplaceable(actual, expected))
    return { replacedActual: actual, replacedExpected: expected }
  util.getOwnEnumerableProperties(expected).forEach((key) => {
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
