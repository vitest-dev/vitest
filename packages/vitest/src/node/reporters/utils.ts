import type { ModuleRunner } from 'vite/module-runner'
import type { Vitest } from '../core'
import type { ResolvedConfig } from '../types/config'
import type { Reporter } from '../types/reporter'
import type { BlobReporter } from './blob'
import type { BuiltinReporters, DefaultReporter, DotReporter, GithubActionsReporter, HangingProcessReporter, JsonReporter, JUnitReporter, TapReporter } from './index'
import { ReportersMap } from './index'

async function loadCustomReporterModule<C extends Reporter>(
  path: string,
  runner: ModuleRunner,
): Promise<new (options?: unknown) => C> {
  let customReporterModule: { default: new () => C }
  try {
    customReporterModule = await runner.import(path)
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
): Promise<Array<Reporter | DefaultReporter | BlobReporter | DotReporter | JsonReporter | TapReporter | JUnitReporter | HangingProcessReporter | GithubActionsReporter>> {
  const runner = ctx.runner
  const promisedReporters = reporterReferences.map(
    async (referenceOrInstance) => {
      if (Array.isArray(referenceOrInstance)) {
        const [reporterName, reporterOptions] = referenceOrInstance

        if (reporterName === 'html') {
          await ctx.packageInstaller.ensureInstalled('@vitest/ui', ctx.config.root, ctx.version)
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

export { createReporters }
