import { expect, test, vi } from 'vitest'
import { loadModalSource } from './dual-id/consumer'

vi.mock('~/dual-id/modal', () => ({
  readModalSource: () => 'mocked modal',
}))

vi.mock('./dual-id/modal', () => ({
  readModalSource: () => 'mocked modal',
}))

test('dual-id mock is active in the file that registered it', () => {
  expect(loadModalSource()).not.toBe('actual modal')
})
