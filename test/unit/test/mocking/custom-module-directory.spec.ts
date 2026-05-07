// @ts-expect-error not typed aliased import
import getState from 'custom-lib'
import { expect, it, vi } from 'vitest'

vi.mock('custom-lib')

it('state is mocked', () => {
  expect(getState()).toBe('mocked')
})
