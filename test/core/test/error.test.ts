import { processError } from '@vitest/utils/error'
import { expect, test } from 'vitest'

test('Can correctly process error where actual and expected contains non writable properties', () => {
  const actual = {}
  const expected = {}

  Object.defineProperty(actual, 'root', {
    value: {
      foo: Object.defineProperty({}, 'sub_properties', {
        value: { bar: 'baz' },
        writable: false,
        enumerable: true,
      }),
    },
    writable: false,
    enumerable: true,
  })
  Object.defineProperty(expected, 'root', {
    value: {
      foo: Object.defineProperty({}, 'sub_properties', {
        value: { bar: 'not baz' },
        writable: false,
        enumerable: true,
      }),
    },
    writable: false,
    enumerable: true,
  })

  const err = {
    actual,
    expected,
  }

  expect(() => processError(err)).not.toThrow(TypeError)
})

test('Can correctly process error where cause is a non writable property', () => {
  const err = new Error('My error')

  Object.defineProperty(err, 'cause', {
    value: new Error('My cause'),
    writable: false,
    enumerable: true,
  })

  expect(() => processError(err)).not.toThrow(TypeError)
})

test('Can correctly process error where cause leads to an infinite recursion', () => {
  const err = new Error('My error')

  Object.defineProperty(err, 'cause', {
    value: err,
    writable: true,
    enumerable: true,
    configurable: true,
  })

  expect(() => processError(err)).not.toThrow()
})
