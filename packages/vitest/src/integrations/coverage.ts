import type { SerializedCoverageConfig } from '../runtime/config'
import { resolveCoverageProviderModule, RuntimeCoverageModuleLoader } from '../utils/coverage'

export async function startCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: RuntimeCoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.startCoverage?.(runtimeOptions)
  }

  return null
}

export async function takeCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: RuntimeCoverageModuleLoader,
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.takeCoverage?.({ moduleExecutionInfo: loader.moduleExecutionInfo })
  }

  return null
}

export async function stopCoverageInsideWorker(
  options: SerializedCoverageConfig | undefined,
  loader: RuntimeCoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.stopCoverage?.(runtimeOptions)
  }

  return null
}
