import { assert, test, vi } from 'vitest'
import { two } from '../src/submodule'

vi.mock(
  '../src/submodule',
  () => ({
    two: 55,
  }),
)

// vi.mock('../src/submodule')

test('vitest correctly passes multiline vi.mock syntax', () => {
  assert.equal(55, two)
})
