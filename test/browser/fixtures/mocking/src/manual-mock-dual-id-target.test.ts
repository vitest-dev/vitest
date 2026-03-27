import { expect, test } from 'vitest'
import { loadModalSource } from './dual-id/consumer'

test('manual mocks from a previous file do not leak into later files', () => {
  expect(loadModalSource()).toBe('actual modal')
})
