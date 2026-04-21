import type { SerializedCoverageConfig } from '../runtime/config'
import type { RuntimeCoverageModuleLoader } from '../utils/coverage'
import { resolveCoverageProviderModule } from '../utils/coverage'

export async function startCoverageInsideWorker(
  options: SerializedCoverageConfig,
  loader: RuntimeCoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.startCoverage?.({
      ...runtimeOptions,
      autoAttachWorkers: options.autoAttachWorkers,
      reportsDirectory: options.reportsDirectory,
    })
  }

  return null
}

export async function takeCoverageInsideWorker(
  options: SerializedCoverageConfig,
  loader: RuntimeCoverageModuleLoader,
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.takeCoverage?.({ moduleExecutionInfo: loader.moduleExecutionInfo })
  }

  return null
}

export async function stopCoverageInsideWorker(
  options: SerializedCoverageConfig,
  loader: RuntimeCoverageModuleLoader,
  runtimeOptions: { isolate: boolean },
): Promise<unknown> {
  const coverageModule = await resolveCoverageProviderModule(options, loader)

  if (coverageModule) {
    return coverageModule.stopCoverage?.(runtimeOptions)
  }

  return null
}
