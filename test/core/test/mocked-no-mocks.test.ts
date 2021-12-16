import { test, vi, expect } from 'vitest'
import { mockedA } from '../src/mockedA'

vi.mock('../src/mockedA.ts')

// it may seem the tests are identical, but they test
// that mockedA wasnt calld twice since it is called inside different suites
test('testing mocking module without __mocks__', () => {
  mockedA()

  expect(mockedA).toHaveBeenCalledTimes(1)
})
