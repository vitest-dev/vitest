import * as squaredModule from '../src/squared.js'
import { squared } from '../src/squared.js'
import { foo } from '../src/set-foo.js'

vi.mock('any')

test('spyOn entire module', () => {
  vi.spyOn(squaredModule, 'squared')
  expect(squared).not.toHaveBeenCalled()
})

test('foo should be 1', () => {
  expect(foo).toBe(1)
})
