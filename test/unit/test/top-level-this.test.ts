import { expect, test } from 'vitest'
import { topLevelThis } from './fixtures/top-level-this'

test('top-level this of a module is the global object', () => {
  expect(topLevelThis).toBe(globalThis)
})
