/*
Copyright (c) 2008-2016 Pivotal Labs

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

import { isObject } from '@vitest/utils'
import type { Tester } from './types'

// Extracted out of jasmine 2.5.2
export function equals(
  a: unknown,
  b: unknown,
  customTesters?: Array<Tester>,
  strictCheck?: boolean,
): boolean {
  customTesters = customTesters || []
  return eq(a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey)
}

const functionToString = Function.prototype.toString

export function isAsymmetric(obj: any) {
  return !!obj && typeof obj === 'object' && 'asymmetricMatch' in obj && isA('Function', obj.asymmetricMatch)
}

export function hasAsymmetric(obj: any, seen = new Set()): boolean {
  if (seen.has(obj))
    return false
  seen.add(obj)
  if (isAsymmetric(obj))
    return true
  if (Array.isArray(obj))
    return obj.some(i => hasAsymmetric(i, seen))
  if (obj instanceof Set)
    return Array.from(obj).some(i => hasAsymmetric(i, seen))
  if (isObject(obj))
    return Object.values(obj).some(v => hasAsymmetric(v, seen))
  return false
}

function asymmetricMatch(a: any, b: any) {
  const asymmetricA = isAsymmetric(a)
  const asymmetricB = isAsymmetric(b)

  if (asymmetricA && asymmetricB)
    return undefined

  if (asymmetricA)
    return a.asymmetricMatch(b)

  if (asymmetricB)
    return b.asymmetricMatch(a)
}

// Equality function lovingly adapted from isEqual in
//   [Underscore](http://underscorejs.org)
function eq(
  a: any,
  b: any,
  aStack: Array<unknown>,
  bStack: Array<unknown>,
  customTesters: Array<Tester>,
  hasKey: any,
): boolean {
  let result = true

  const asymmetricResult = asymmetricMatch(a, b)
  if (asymmetricResult !== undefined)
    return asymmetricResult

  for (let i = 0; i < customTesters.length; i++) {
    const customTesterResult = customTesters[i](a, b)
    if (customTesterResult !== undefined)
      return customTesterResult
  }

  if (a instanceof Error && b instanceof Error)
    return a.message === b.message

  if (typeof URL === 'function' && a instanceof URL && b instanceof URL)
    return a.href === b.href

  if (Object.is(a, b))
    return true

  // A strict comparison is necessary because `null == undefined`.
  if (a === null || b === null)
    return a === b

  const className = Object.prototype.toString.call(a)
  if (className !== Object.prototype.toString.call(b))
    return false

  switch (className) {
    case '[object Boolean]':
    case '[object String]':
    case '[object Number]':
      if (typeof a !== typeof b) {
        // One is a primitive, one a `new Primitive()`
        return false
      }
      else if (typeof a !== 'object' && typeof b !== 'object') {
        // both are proper primitives
        return Object.is(a, b)
      }
      else {
        // both are `new Primitive()`s
        return Object.is(a.valueOf(), b.valueOf())
      }
    case '[object Date]': {
      const numA = +a
      const numB = +b
      // Coerce dates to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are equivalent.
      return (numA === numB) || (Number.isNaN(numA) && Number.isNaN(numB))
    }
    // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source === b.source && a.flags === b.flags
  }
  if (typeof a !== 'object' || typeof b !== 'object')
    return false

  // Use DOM3 method isEqualNode (IE>=9)
  if (isDomNode(a) && isDomNode(b))
    return a.isEqualNode(b)

  // Used to detect circular references.
  let length = aStack.length
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a)
      return bStack[length] === b

    else if (bStack[length] === b)
      return false
  }
  // Add the first object to the stack of traversed objects.
  aStack.push(a)
  bStack.push(b)
  // Recursively compare objects and arrays.
  // Compare array lengths to determine if a deep comparison is necessary.
  if (className === '[object Array]' && a.length !== b.length)
    return false

  // Deep compare objects.
  const aKeys = keys(a, hasKey)
  let key
  let size = aKeys.length

  // Ensure that both objects contain the same number of properties before comparing deep equality.
  if (keys(b, hasKey).length !== size)
    return false

  while (size--) {
    key = aKeys[size]

    // Deep compare each member
    result
      = hasKey(b, key)
      && eq(a[key], b[key], aStack, bStack, customTesters, hasKey)

    if (!result)
      return false
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop()
  bStack.pop()

  return result
}

function keys(obj: object, hasKey: (obj: object, key: string) => boolean) {
  const keys = []

  for (const key in obj) {
    if (hasKey(obj, key))
      keys.push(key)
  }
  return keys.concat(
    (Object.getOwnPropertySymbols(obj) as Array<any>).filter(
      symbol =>
        (Object.getOwnPropertyDescriptor(obj, symbol) as PropertyDescriptor)
          .enumerable,
    ),
  )
}

function hasDefinedKey(obj: any, key: string) {
  return hasKey(obj, key) && obj[key] !== undefined
}

function hasKey(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function isA(typeName: string, value: unknown) {
  return Object.prototype.toString.apply(value) === `[object ${typeName}]`
}

function isDomNode(obj: any): boolean {
  return (
    obj !== null
    && typeof obj === 'object'
    && 'nodeType' in obj
    && typeof obj.nodeType === 'number'
    && 'nodeName' in obj
    && typeof obj.nodeName === 'string'
    && 'isEqualNode' in obj
    && typeof obj.isEqualNode === 'function'
  )
}

export function fnNameFor(func: Function) {
  if (func.name)
    return func.name

  const matches = functionToString
    .call(func)
    .match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/)
  return matches ? matches[1] : '<anonymous>'
}

function getPrototype(obj: object) {
  if (Object.getPrototypeOf)
    return Object.getPrototypeOf(obj)

  if (obj.constructor.prototype === obj)
    return null

  return obj.constructor.prototype
}

export function hasProperty(obj: object | null, property: string): boolean {
  if (!obj)
    return false

  if (Object.prototype.hasOwnProperty.call(obj, property))
    return true

  return hasProperty(getPrototype(obj), property)
}

// SENTINEL constants are from https://github.com/facebook/immutable-js
const IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@'
const IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@'
const IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@'

export function isImmutableUnorderedKeyed(maybeKeyed: any) {
  return !!(
    maybeKeyed
    && maybeKeyed[IS_KEYED_SENTINEL]
    && !maybeKeyed[IS_ORDERED_SENTINEL]
  )
}

export function isImmutableUnorderedSet(maybeSet: any) {
  return !!(
    maybeSet
    && maybeSet[IS_SET_SENTINEL]
    && !maybeSet[IS_ORDERED_SENTINEL]
  )
}

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
const IteratorSymbol = Symbol.iterator

function hasIterator(object: any) {
  return !!(object != null && object[IteratorSymbol])
}

export function iterableEquality(a: any, b: any, aStack: Array<any> = [], bStack: Array<any> = []): boolean | undefined {
  if (
    typeof a !== 'object'
    || typeof b !== 'object'
    || Array.isArray(a)
    || Array.isArray(b)
    || !hasIterator(a)
    || !hasIterator(b)
  )
    return undefined

  if (a.constructor !== b.constructor)
    return false

  let length = aStack.length
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a)
      return bStack[length] === b
  }
  aStack.push(a)
  bStack.push(b)

  const iterableEqualityWithStack = (a: any, b: any) => iterableEquality(a, b, [...aStack], [...bStack])

  if (a.size !== undefined) {
    if (a.size !== b.size) {
      return false
    }
    else if (isA('Set', a) || isImmutableUnorderedSet(a)) {
      let allFound = true
      for (const aValue of a) {
        if (!b.has(aValue)) {
          let has = false
          for (const bValue of b) {
            const isEqual = equals(aValue, bValue, [iterableEqualityWithStack])
            if (isEqual === true)
              has = true
          }

          if (has === false) {
            allFound = false
            break
          }
        }
      }
      // Remove the first value from the stack of traversed values.
      aStack.pop()
      bStack.pop()
      return allFound
    }
    else if (isA('Map', a) || isImmutableUnorderedKeyed(a)) {
      let allFound = true
      for (const aEntry of a) {
        if (
          !b.has(aEntry[0])
          || !equals(aEntry[1], b.get(aEntry[0]), [iterableEqualityWithStack])
        ) {
          let has = false
          for (const bEntry of b) {
            const matchedKey = equals(aEntry[0], bEntry[0], [
              iterableEqualityWithStack,
            ])

            let matchedValue = false
            if (matchedKey === true) {
              matchedValue = equals(aEntry[1], bEntry[1], [
                iterableEqualityWithStack,
              ])
            }
            if (matchedValue === true)
              has = true
          }

          if (has === false) {
            allFound = false
            break
          }
        }
      }
      // Remove the first value from the stack of traversed values.
      aStack.pop()
      bStack.pop()
      return allFound
    }
  }

  const bIterator = b[IteratorSymbol]()

  for (const aValue of a) {
    const nextB = bIterator.next()
    if (
      nextB.done
      || !equals(aValue, nextB.value, [iterableEqualityWithStack])
    )
      return false
  }
  if (!bIterator.next().done)
    return false

  // Remove the first value from the stack of traversed values.
  aStack.pop()
  bStack.pop()
  return true
}

/**
 * Checks if `hasOwnProperty(object, key)` up the prototype chain, stopping at `Object.prototype`.
 */
function hasPropertyInObject(object: object, key: string): boolean {
  const shouldTerminate
    = !object || typeof object !== 'object' || object === Object.prototype

  if (shouldTerminate)
    return false

  return (
    Object.prototype.hasOwnProperty.call(object, key)
    || hasPropertyInObject(Object.getPrototypeOf(object), key)
  )
}

function isObjectWithKeys(a: any) {
  return isObject(a)
  && !(a instanceof Error)
  && !(Array.isArray(a))
  && !(a instanceof Date)
}

export function subsetEquality(object: unknown, subset: unknown): boolean | undefined {
  // subsetEquality needs to keep track of the references
  // it has already visited to avoid infinite loops in case
  // there are circular references in the subset passed to it.
  const subsetEqualityWithContext
    = (seenReferences: WeakMap<object, boolean> = new WeakMap()) =>
      (object: any, subset: any): boolean | undefined => {
        if (!isObjectWithKeys(subset))
          return undefined

        return Object.keys(subset).every((key) => {
          if (isObjectWithKeys(subset[key])) {
            if (seenReferences.has(subset[key]))
              return equals(object[key], subset[key], [iterableEquality])

            seenReferences.set(subset[key], true)
          }
          const result
            = object != null
            && hasPropertyInObject(object, key)
            && equals(object[key], subset[key], [
              iterableEquality,
              subsetEqualityWithContext(seenReferences),
            ])
          // The main goal of using seenReference is to avoid circular node on tree.
          // It will only happen within a parent and its child, not a node and nodes next to it (same level)
          // We should keep the reference for a parent and its child only
          // Thus we should delete the reference immediately so that it doesn't interfere
          // other nodes within the same level on tree.
          seenReferences.delete(subset[key])
          return result
        })
      }

  return subsetEqualityWithContext()(object, subset)
}

export function typeEquality(a: any, b: any): boolean | undefined {
  if (a == null || b == null || a.constructor === b.constructor)
    return undefined

  return false
}

export function arrayBufferEquality(a: unknown, b: unknown): boolean | undefined {
  let dataViewA = a as DataView
  let dataViewB = b as DataView

  if (!(a instanceof DataView && b instanceof DataView)) {
    if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer))
      return undefined

    try {
      dataViewA = new DataView(a)
      dataViewB = new DataView(b)
    }
    catch {
      return undefined
    }
  }

  // Buffers are not equal when they do not have the same byte length
  if (dataViewA.byteLength !== dataViewB.byteLength)
    return false

  // Check if every byte value is equal to each other
  for (let i = 0; i < dataViewA.byteLength; i++) {
    if (dataViewA.getUint8(i) !== dataViewB.getUint8(i))
      return false
  }

  return true
}

export function sparseArrayEquality(a: unknown, b: unknown): boolean | undefined {
  if (!Array.isArray(a) || !Array.isArray(b))
    return undefined

  // A sparse array [, , 1] will have keys ["2"] whereas [undefined, undefined, 1] will have keys ["0", "1", "2"]
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    equals(a, b, [iterableEquality, typeEquality], true) && equals(aKeys, bKeys)
  )
}

export function generateToBeMessage(deepEqualityName: string, expected = '#{this}', actual = '#{exp}') {
  const toBeMessage = `expected ${expected} to be ${actual} // Object.is equality`

  if (['toStrictEqual', 'toEqual'].includes(deepEqualityName))
    return `${toBeMessage}\n\nIf it should pass with deep equality, replace "toBe" with "${deepEqualityName}"\n\nExpected: ${expected}\nReceived: serializes to the same string\n`

  return toBeMessage
}

export function pluralize(word: string, count: number): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
