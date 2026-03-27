import { expect, test, vi } from 'vitest'
import { loadModalSource } from './dual-id/consumer'

vi.mock('~/dual-id/modal', () => ({
  readModalSource: () => 'alias mock',
}))

vi.mock('./dual-id/modal', () => ({
  readModalSource: () => 'relative mock',
}))

test('manual mocks registered for the same module under multiple ids stay local to this file', () => {
  expect(loadModalSource()).not.toBe('actual modal')
})
