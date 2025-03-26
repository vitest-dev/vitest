import type { ModuleExecutionInfo } from 'vite-node/client'
import type { SerializedCoverageConfig } from '../runtime/config'

export interface RuntimeCoverageModuleLoader {
  executeId: (id: string) => Promise<{ default: RuntimeCoverageProviderModule }>
  isBrowser?: boolean
  moduleExecutionInfo?: ModuleExecutionInfo
}

export interface RuntimeCoverageProviderModule {
  /**
   * Factory for creating a new coverage provider
   */
  getProvider: () => any // not needed for runtime

  /**
   * Executed before tests are run in the worker thread.
   */
  startCoverage?: (runtimeOptions: { isolate: boolean }) => unknown | Promise<unknown>

  /**
   * Executed on after each run in the worker thread. Possible to return a payload passed to the provider
   */
  takeCoverage?: (runtimeOptions?: { moduleExecutionInfo?: ModuleExecutionInfo }) => unknown | Promise<unknown>

  /**
   * Executed after all tests have been run in the worker thread.
   */
  stopCoverage?: (runtimeOptions: { isolate: boolean }) => unknown | Promise<unknown>
}

export const CoverageProviderMap: Record<string, string> = {
  v8: '@vitest/coverage-v8',
  istanbul: '@vitest/coverage-istanbul',
}

export async function resolveCoverageProviderModule(
  options: SerializedCoverageConfig | undefined,
  loader: RuntimeCoverageModuleLoader,
): Promise<RuntimeCoverageProviderModule | null> {
  if (!options?.enabled || !options.provider) {
    return null
  }

  const provider = options.provider

  if (provider === 'v8' || provider === 'istanbul') {
    let builtInModule = CoverageProviderMap[provider]

    if (provider === 'v8' && loader.isBrowser) {
      builtInModule += '/browser'
    }

    const { default: coverageModule } = await loader.executeId(builtInModule)

    if (!coverageModule) {
      throw new Error(
        `Failed to load ${CoverageProviderMap[provider]}. Default export is missing.`,
      )
    }

    return coverageModule
  }

  let customProviderModule

  try {
    customProviderModule = await loader.executeId(options.customProviderModule!)
  }
  catch (error) {
    throw new Error(
      `Failed to load custom CoverageProviderModule from ${options.customProviderModule}`,
      { cause: error },
    )
  }

  if (customProviderModule.default == null) {
    throw new Error(
      `Custom CoverageProviderModule loaded from ${options.customProviderModule} was not the default export`,
    )
  }

  return customProviderModule.default
}
