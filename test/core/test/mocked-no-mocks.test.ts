import { expect, test, vi } from 'vitest'
import { mockedA } from '../src/mockedA'
import { mockedB } from '../src/mockedB'

vi.mock('../src/mockedA.ts')
vi.mock('../src/mockedB.ts')

// it may seem the tests are identical, but they test
// that mockedA wasn't called twice since it is called inside different suites
test('testing mocking module without __mocks__', () => {
  mockedA()
  expect(mockedA).toHaveBeenCalledTimes(1)
})

test('mocking several modules work', () => {
  mockedB()

  expect(mockedA).toHaveBeenCalledTimes(2)
  expect(mockedB).toHaveBeenCalledTimes(1)
})
