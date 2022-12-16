import { expect, test, vi } from 'vitest'
import { main } from '../src/main.js'

vi.mock('../src/A', async () => ({
  ...(await vi.importActual<any>('../src/A')),
  funcA: () => 'mockedA',
}))

test('main', () => {
  expect(main()).toBe('mockedA')
})
