import { expect, test, vi } from 'vitest'
import { main, mainB } from '../src/main.js'
import x from '../src/export-default-circle-index'

vi.mock('../src/A', async () => ({
  ...(await vi.importActual<any>('../src/A')),
  funcA: () => 'mockedA',
}))

vi.mock('../src/B', async () => ({
  ...(await vi.importActual<any>('../src/B')),
  funcB: () => 'mockedB',
}))

vi.mock('../src/export-default-circle-b')

test('can import actual inside mock factory', () => {
  expect(main()).toBe('mockedA')
})

test('can import in top level and inside mock factory', () => {
  expect(mainB()).toBe('mockedB')
})

test('can mock a circular dependency', () => {
  expect(x()).toBe(undefined)
})
