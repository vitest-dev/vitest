// @ts-expect-error not typed aliased import
import getState from 'custom-lib'

vi.mock('custom-lib')

it('state is mocked', () => {
  expect(getState()).toBe('mocked')
})
