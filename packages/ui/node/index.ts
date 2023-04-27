import { fileURLToPath } from 'node:url'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { coverageConfigDefaults } from 'vitest/config'
import type { ResolvedConfig, Vitest } from 'vitest'

export default (ctx: Vitest) => {
  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configureServer(server) {
      const uiOptions: ResolvedConfig = ctx.config
      const base = uiOptions.uiBase
      const coverageFolder = resolveCoverageFolder(ctx)
      const coveragePath = coverageFolder ? `/${basename(coverageFolder)}/` : undefined
      if (coveragePath && base === coveragePath)
        throw new Error(`The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`)

      coverageFolder && server.middlewares.use(coveragePath!, sirv(coverageFolder, {
        single: true,
        dev: true,
      }))
      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      server.middlewares.use(base, sirv(clientDist, {
        single: true,
        dev: true,
      }))
    },
  }
}

function resolveCoverageFolder(ctx: Vitest) {
  const options: ResolvedConfig = ctx.config
  const enabled = options.api?.port
    && options.coverage?.enabled
    && options.coverage.reporter.some((reporter) => {
      if (typeof reporter === 'string')
        return reporter === 'html'

      return reporter.length && reporter.includes('html')
    })

  // reportsDirectory not resolved yet
  return enabled
    ? resolve(
      ctx.config?.root || options.root || process.cwd(),
      options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
    )
    : undefined
}
