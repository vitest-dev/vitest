import { processError } from '@vitest/utils'
import { expect, test } from 'vitest'

test('Can correctly process error where actual and expected contains non writable properties', () => {
  const actual = {}
  const expected = {}
  Object.defineProperty(actual, 'root', {
    value: { foo: 'bar' },
    writable: false,
    enumerable: true,
  })
  Object.defineProperty(expected, 'root', {
    value: { foo: 'NOT BAR' },
    writable: false,
    enumerable: true,
  })

  const err = {
    actual,
    expected,
  }

  expect(() => processError(err)).not.toThrow(TypeError)
})
