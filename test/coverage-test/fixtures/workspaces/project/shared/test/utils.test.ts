import { expect, test } from 'vitest'
import { raise } from '../src/utils'

test('raise throws error', () => {
  const message = 'Value cannot be undefined'
  expect(() => raise(message)).toThrowError(message)
})
