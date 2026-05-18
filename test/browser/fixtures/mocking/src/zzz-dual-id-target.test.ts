import { expect, test } from 'vitest'
import { loadModalSource } from './dual-id/consumer'

test('dual-id mock from the previous file does not leak into this one', () => {
  expect(loadModalSource()).toBe('actual modal')
})
