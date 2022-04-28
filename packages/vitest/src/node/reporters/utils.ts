import type { ViteNodeRunner } from 'vite-node/client'
import type { Reporter } from '../../types'
import { ReportersMap } from './index'
import type { BuiltinReporters } from './index'

async function loadCustomReporterModule<C extends Reporter>(path: string, runner: ViteNodeRunner): Promise<new () => C> {
  let customReporterModule: { default: new () => C }
  try {
    customReporterModule = await runner.executeId(path)
  }
  catch (customReporterModuleError) {
    throw new Error(`Failed to load custom Reporter from ${path}`, { cause: customReporterModuleError as Error })
  }

  if (customReporterModule.default === null || customReporterModule.default === undefined)
    throw new Error(`Custom reporter loaded from ${path} was not the default export`)

  return customReporterModule.default
}

function createReporters(reporterReferences: Array<string|Reporter|BuiltinReporters>, runner: ViteNodeRunner) {
  const promisedReporters = reporterReferences.map(async (referenceOrInstance) => {
    if (typeof referenceOrInstance === 'string') {
      if (referenceOrInstance in ReportersMap) {
        const BuiltinReporter = ReportersMap[referenceOrInstance as BuiltinReporters]
        return new BuiltinReporter()
      }
      else {
        const CustomReporter = await loadCustomReporterModule(referenceOrInstance, runner)
        return new CustomReporter()
      }
    }
    return referenceOrInstance
  })
  return Promise.all(promisedReporters)
}

export { createReporters }
