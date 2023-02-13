import { importModule } from 'local-pkg'
import type { CoverageOptions, CoverageProvider, CoverageProviderModule } from '../types'

interface Loader {
  executeId: (id: string) => Promise<{ default: CoverageProviderModule }>
}

export const CoverageProviderMap: Record<string, string> = {
  c8: '@vitest/coverage-c8',
  istanbul: '@vitest/coverage-istanbul',
}

async function resolveCoverageProviderModule(options: CoverageOptions & Required<Pick<CoverageOptions, 'provider'>>, loader: Loader) {
  const provider = options.provider

  if (provider === 'c8' || provider === 'istanbul')
    return await importModule<CoverageProviderModule>(CoverageProviderMap[provider])

  let customProviderModule

  try {
    customProviderModule = await loader.executeId(options.customProviderModule)
  }
  catch (error) {
    throw new Error(`Failed to load custom CoverageProviderModule from ${options.customProviderModule}`, { cause: error })
  }

  if (customProviderModule.default == null)
    throw new Error(`Custom CoverageProviderModule loaded from ${options.customProviderModule} was not the default export`)

  return customProviderModule.default
}

export async function getCoverageProvider(options: CoverageOptions, loader: Loader): Promise<CoverageProvider | null> {
  if (options.enabled && options.provider) {
    const { getProvider } = await resolveCoverageProviderModule(options, loader)
    return await getProvider()
  }
  return null
}

export async function takeCoverageInsideWorker(options: CoverageOptions, loader: Loader) {
  if (options.enabled && options.provider) {
    const { takeCoverage } = await resolveCoverageProviderModule(options, loader)
    return await takeCoverage?.()
  }
}
