import testModule, { run } from 'node:test'
import { expect, it } from 'vitest'

it('node:test works correctly', () => {
  expect(run).toBeTypeOf('function')
  expect(testModule).toBeTypeOf('function')
  expect(testModule.run).toBeTypeOf('function')
})
