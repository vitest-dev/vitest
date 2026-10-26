import { expect, test, vi } from 'vitest'
import { late } from '../src/late'

vi.mock('../src/late', () => ({ late: () => 'mocked' }))

test('a mock of a module that the page already imported', () => {
  expect(late()).toBe('mocked')
})
