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

  const serialisedError = processError(err)

  expect(serialisedError.name).toBeTypeOf('string')
  expect(serialisedError.stack).toBeTypeOf('string')
  expect(serialisedError.message).toBeTypeOf('string')

  expect(serialisedError.cause?.name).toBeTypeOf('string')
  expect(serialisedError.cause?.stack).toBeTypeOf('string')
  expect(serialisedError.cause?.message).toBeTypeOf('string')
})

test('simple error has message, stack and name', () => {
  const error = new Error('My error')
  const serialisedError = processError(error)

  expect(error.message).toBe(serialisedError.message)
  expect(error.name).toBe(serialisedError.name)
  expect(error.stack).toBe(serialisedError.stack)
})

test('error with toJSON has message, stack and name', () => {
  class SerializableError extends Error {
    toJSON() {
      return { ...this }
    }
  }

  const error = new SerializableError('My error')
  const serialisedError = processError(error)

  expect(error.message).toBe(serialisedError.message)
  expect(error.name).toBe(serialisedError.name)
  expect(error.stack).toBe(serialisedError.stack)
})

test('error with toJSON doesn\'t override nessage, stack and name if it\'s there already', () => {
  class SerializableError extends Error {
    toJSON() {
      return {
        name: 'custom',
        stack: 'custom stack',
        message: 'custom message',
      }
    }
  }

  const error = new SerializableError('My error')
  const serialisedError = processError(error)

  expect(serialisedError.name).toBe('custom')
  expect(serialisedError.stack).toBe('custom stack')
  expect(serialisedError.message).toBe('custom message')
})
