import { expect, test } from 'vitest'
import { getQuery } from '../src/query'

test('query is defined', () => {
  expect(getQuery()).toBeDefined()
})
