import type { Reporter } from '../../types'
import { ReportersMap } from './index'
import type { BuiltinReporters } from './index'

async function loadCustomReporterModule<C extends Reporter>(path: string, fetchModule: (id: string) => Promise<any>): Promise<new () => C> {
  let customReporterModule: { default: new () => C }
  try {
    customReporterModule = await fetchModule(path)
  }
  catch (customReporterModuleError) {
    throw new Error(`Failed to load custom Reporter from ${path}`, { cause: customReporterModuleError as Error })
  }

  if (customReporterModule.default === null || customReporterModule.default === undefined)
    throw new Error(`Custom reporter loaded from ${path} was not the default export`)

  return customReporterModule.default
}

function createReporters(reporterReferences: Array<string|Reporter|BuiltinReporters>, fetchModule: (id: string) => Promise<any>) {
  const promisedReporters = reporterReferences.map(async(referenceOrInstance) => {
    if (typeof referenceOrInstance === 'string') {
      if (referenceOrInstance in ReportersMap) {
        const Reporter = ReportersMap[referenceOrInstance as BuiltinReporters]
        return new Reporter()
      }
      else {
        const CustomReporter = await loadCustomReporterModule(referenceOrInstance, fetchModule)
        return new CustomReporter()
      }
    }
    return referenceOrInstance
  })
  return Promise.all(promisedReporters)
}

export { createReporters }
