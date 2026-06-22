import { expect, test, vi } from 'vitest'
import { thisIsOk } from '../../../src/mocks/has space in path'

vi.mock('../../../src/mocks/has space in path', () => ({ thisIsOk: true }))

test('can mock modules when vi.mock caller is inside a directory with spaces', () => {
  expect(thisIsOk).toBe(true)
})
