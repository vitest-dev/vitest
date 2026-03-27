import V8Provider from '@vitest/coverage-v8'
import packageJson from '@vitest/coverage-v8/package.json'
import { expect, test, vi } from 'vitest'
import { configDefaults } from 'vitest/config'

test('v8 provider silently excludes parse failures from uncovered file coverage', async () => {
  const provider = await V8Provider.getProvider()
  const error = vi.fn()

  provider.initialize({
    version: packageJson.version,
    logger: { error, log: vi.fn(), warn: vi.fn() },
    config: { ...configDefaults, root: process.cwd() },
    _coverageOptions: configDefaults.coverage,
    projects: [],
  } as any)

  const remappedCoverage = await (provider as any).remapCoverage(
    'file:///virtual-uncovered.ts',
    0,
    {
      code: `
        import { something } from 'virtual:some-plugin'
        export const loadRemote = async (name: string): Promise<unknown> => {
          const module = await something(name)
          return module
        }
      `,
    },
    [],
  )

  expect(remappedCoverage).toEqual({})
  expect(error).not.toHaveBeenCalled()
})
