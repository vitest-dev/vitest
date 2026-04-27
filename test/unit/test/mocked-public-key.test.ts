import { expect, test, vi } from 'vitest'
import { dynamicImport } from '../src/dynamic-import'

vi.mock('test', () => {
  return {
    foo: 'foo',
  }
})

test('testing toMatchObject for mocking module', async () => {
  const result = await dynamicImport('test')
  expect(result).toMatchObject({
    foo: 'foo',
  })
})
