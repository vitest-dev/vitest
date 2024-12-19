import type { ViteNodeRunner } from 'vite-node/client'
import type { Vitest } from '../core'
import type { ResolvedConfig } from '../types/config'
import type { Reporter } from '../types/reporter'
import type { BenchmarkBuiltinReporters, BuiltinReporters } from './index'
import { BenchmarkReportsMap, ReportersMap } from './index'

async function loadCustomReporterModule<C extends Reporter>(
  path: string,
  runner: ViteNodeRunner,
): Promise<new (options?: unknown) => C> {
  let customReporterModule: { default: new () => C }
  try {
    customReporterModule = await runner.executeId(path)
  }
  catch (customReporterModuleError) {
    throw new Error(`Failed to load custom Reporter from ${path}`, {
      cause: customReporterModuleError as Error,
    })
  }

  if (
    customReporterModule.default === null
    || customReporterModule.default === undefined
  ) {
    throw new Error(
      `Custom reporter loaded from ${path} was not the default export`,
    )
  }

  return customReporterModule.default
}

function createReporters(
  reporterReferences: ResolvedConfig['reporters'],
  ctx: Vitest,
) {
  const runner = ctx.runner
  const promisedReporters = reporterReferences.map(
    async (referenceOrInstance) => {
      if (Array.isArray(referenceOrInstance)) {
        const [reporterName, reporterOptions] = referenceOrInstance

        if (reporterName === 'html') {
          await ctx.packageInstaller.ensureInstalled('@vitest/ui', runner.root, ctx.version)
          const CustomReporter = await loadCustomReporterModule(
            '@vitest/ui/reporter',
            runner,
          )
          return new CustomReporter(reporterOptions)
        }
        else if (reporterName in ReportersMap) {
          const BuiltinReporter
            = ReportersMap[reporterName as BuiltinReporters]
          return new BuiltinReporter(reporterOptions)
        }
        else {
          const CustomReporter = await loadCustomReporterModule(
            reporterName,
            runner,
          )
          return new CustomReporter(reporterOptions)
        }
      }

      return referenceOrInstance
    },
  )
  return Promise.all(promisedReporters)
}

function createBenchmarkReporters(
  reporterReferences: Array<string | Reporter | BenchmarkBuiltinReporters>,
  runner: ViteNodeRunner,
) {
  const promisedReporters = reporterReferences.map(
    async (referenceOrInstance) => {
      if (typeof referenceOrInstance === 'string') {
        if (referenceOrInstance in BenchmarkReportsMap) {
          const BuiltinReporter
            = BenchmarkReportsMap[
              referenceOrInstance as BenchmarkBuiltinReporters
            ]
          return new BuiltinReporter()
        }
        else {
          const CustomReporter = await loadCustomReporterModule(
            referenceOrInstance,
            runner,
          )
          return new CustomReporter()
        }
      }
      return referenceOrInstance
    },
  )
  return Promise.all(promisedReporters)
}

export { createBenchmarkReporters, createReporters }
