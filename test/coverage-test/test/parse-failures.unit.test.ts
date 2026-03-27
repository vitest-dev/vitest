import { configDefaults } from 'vitest/config'
import { afterEach, expect, test, vi } from 'vitest'
import { providerInternals, V8CoverageProvider } from '../../../packages/coverage-v8/src/provider.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

test('v8 provider excludes parse failures without logging an error', async () => {
  const parseCoverageAst = vi.spyOn(providerInternals, 'parseCoverageAst').mockRejectedValue(new Error('Parse failed with 1 error'))
  const provider = new V8CoverageProvider() as any
  const error = vi.fn()

  provider.ctx = {
    logger: { error },
  }
  provider.options = configDefaults.coverage

  const result = await provider.remapCoverage(
    'file:///fixtures/src/example.ts',
    0,
    { code: 'export const value = (name: string) => name' },
    [],
  )

  expect(result).toEqual({})
  expect(parseCoverageAst).toHaveBeenCalledWith('export const value = (name: string) => name')
  expect(error).not.toHaveBeenCalled()
})
