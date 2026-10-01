import { expect, test } from 'vitest'
import { makeId } from '../src/node-built-ins'

test('makeId', () => {
  expect(makeId()).toBeTypeOf('string')
})
