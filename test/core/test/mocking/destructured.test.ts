import { expect, test, vi } from 'vitest'
// @ts-expect-error mocked module
import * as squaredModule from '../../../mocks/src/squared'
// @ts-expect-error mocked module
import { squared } from '../../../mocks/src/squared'
import { foo } from '../../../mocks/src/set-foo.js'

vi.mock('any')

test('spyOn entire module', () => {
  vi.spyOn(squaredModule, 'squared')
  expect(squared).not.toHaveBeenCalled()
})

test('foo should be 1', () => {
  expect(foo).toBe(1)
})
