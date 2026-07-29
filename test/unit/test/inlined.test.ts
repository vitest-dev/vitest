// @ts-expect-error not typed lib
import typeOfModule from 'inline-lib'
import { expect, test } from 'vitest'

test('inline lib has exports injected even though it is ESM', () => {
  expect(typeOfModule()).toBe('object')
})
