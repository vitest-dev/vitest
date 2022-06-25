import { thisIsOk } from '../src/has space in path'

vi.mock('../src/has space in path', () => ({ thisIsOk: true }))

test('modules with spaces in name is mocked', () => {
  expect(thisIsOk).toBe(true)
})
