import { expect, test, vi } from 'vitest'
import { thisIsOk } from '../../src/mocks/has space in path'

vi.mock('../../src/mocks/has space in path', () => ({ thisIsOk: true }))

test('modules with spaces in name is mocked', () => {
  expect(thisIsOk).toBe(true)
})
