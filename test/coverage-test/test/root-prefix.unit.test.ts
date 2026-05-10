import { expect, test } from 'vitest'
import { BaseCoverageProvider } from 'vitest/node'

test('coverage roots do not include sibling directories with the same prefix', () => {
  const provider = new BaseCoverageProvider()

  provider.options = {
    allowExternal: false,
    exclude: [],
    include: ['**'],
  } as any
  provider.roots = ['/workspace/packages/test']

  expect(provider.isIncluded('/workspace/packages/test/src/index.ts')).toBe(true)
  expect(provider.isIncluded('/workspace/packages/test-a/src/index.ts')).toBe(false)
})
