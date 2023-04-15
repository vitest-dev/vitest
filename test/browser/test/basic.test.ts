import { expect, it } from 'vitest'

it('basic', async () => {
  expect(globalThis.performance).toBeDefined()
})

it('basic 2', () => {
  expect(globalThis.window).toBeDefined()
})

it.each([
  ['x', true],
  ['y', false],
])('%s is x', (val, expectedResult) => {
  expect(val === 'x').toBe(expectedResult)
})
