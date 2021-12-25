import { expect, test, vi } from 'vitest'
import { mockedA } from '../../src/mockedA'
import { mockedB } from '../../src/mockedB'

vi.mock('../../src/mockedA.ts')
vi.mock('../../src/mockedB.ts')

test('testing mocking module without __mocks__', () => {
  mockedA()
  expect(mockedA).toHaveBeenCalledTimes(1)
})

test('mocking several modules work', () => {
  // Cannot unmock a module that has been mocked via a file path
  // See more: https://stackoverflow.com/a/56512217
  // vi.mocked(mockedB).mockRestore()

  mockedB()

  expect(mockedA).toHaveBeenCalledTimes(1)
  expect(mockedB).toHaveBeenCalledTimes(1)
})
