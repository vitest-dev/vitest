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
