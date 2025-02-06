import type {
  CoverageModuleLoader,
  CoverageProvider,
} from '../node/types/coverage'
import type { SerializedCoverageConfig } from '../runtime/config'

export const CoverageProviderMap: Record<string, string> = {
  v8: '@vitest/coverage-v8',
  istanbul: '@vitest/coverage-istanbul',
}

async function resolveCoverageProviderModule(
  options: SerializedCoverageConfig | undefined,
  loader: CoverageModuleLoader,
) {
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

export async function getCoverageProvider(
  options: SerializedCoverageConfig | undefined,
  loader: CoverageModuleLoader,
): Promise<CoverageProvider | null> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.getProvider()
  }

  return null
}

export async function startCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: CoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.startCoverage?.(runtimeOptions)
  }

  return null
}

export async function takeCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: CoverageModuleLoader,
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.takeCoverage?.({ moduleExecutionInfo: loader.moduleExecutionInfo })
  }

  return null
}

export async function stopCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: CoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
) {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.stopCoverage?.(runtimeOptions)
  }

  return null
}
