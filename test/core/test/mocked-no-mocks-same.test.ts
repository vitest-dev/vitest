import { expect, test, vi } from 'vitest'
import { mockedA } from '../src/mockedA'

vi.mock('../src/mockedA.ts')

test('testing mocking module without __mocks__ - suites dont conflict', () => {
  mockedA()

  expect(mockedA).toHaveBeenCalledTimes(1)
})
