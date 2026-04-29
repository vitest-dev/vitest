import { expect, test, vi } from 'vitest'
import { mockedA } from '../src/mockedA'
import { mockedB } from '../src/mockedB'

vi.mock('../src/mockedA.ts')
vi.mock('../src/mockedB.ts')

test('testing mocking module without __mocks__', () => {
  mockedA()
  expect(mockedA).toHaveBeenCalledTimes(1)
})

test('mocking several modules work', () => {
  vi.mocked(mockedB).mockRestore()

  mockedB()

  // mockedA is not called because mockedB is restored to be undefined
  expect(mockedA).toHaveBeenCalledTimes(1)
  expect(mockedB).toHaveBeenCalledTimes(1)
})
