import { B } from '../src/sourceB'

test('shouldnt run', () => {
  expect(B).toBe('B')
  expect.fail()
})
