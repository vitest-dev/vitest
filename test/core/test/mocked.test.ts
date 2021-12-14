import { vitest, test, assert } from 'vitest'
import { two } from '../src/submodule'

vitest.mock('../src/submodule')

test('Math.sqrt()', () => {
  assert.equal(Math.sqrt(4) + 1, two)
})
