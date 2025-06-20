import { expect, test, vi } from 'vitest'
import x from '../../src/mocks/export-default-circle-index.js'
// @ts-expect-error not typed
import { main, mainB } from '../../src/mocks/main.js'

vi.mock('../../src/mocks/A', async () => ({
  ...(await vi.importActual<any>('../../src/mocks/A')),
  funcA: () => 'mockedA',
}))

vi.mock('../../src/mocks/B', async () => ({
  ...(await vi.importActual<any>('../../src/mocks/B')),
  funcB: () => 'mockedB',
}))

vi.mock('../../src/mocks/export-default-circle-b')

test('can import actual inside mock factory', () => {
  expect(main()).toBe('mockedA')
})

test('can import in top level and inside mock factory', () => {
  expect(mainB()).toBe('mockedB')
})

test('can mock a circular dependency', () => {
  expect(x()).toBe(undefined)
})
