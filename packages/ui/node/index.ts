import { fileURLToPath } from 'node:url'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { coverageConfigDefaults } from 'vitest/config'
import type { Vitest } from 'vitest'

export default (ctx: Vitest) => {
  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configureServer(server) {
      const uiOptions = ctx.config.ui
      const base = uiOptions.baseURL
      const coverageFolder = resolveCoverageFolder(ctx)
      const coveragePath = coverageFolder ? coverageFolder[1] : undefined
      if (coveragePath && base === coveragePath)
        throw new Error(`The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`)

      coverageFolder && server.middlewares.use(coveragePath!, sirv(coverageFolder[0], {
        single: true,
        dev: true,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
        },
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
  const options = ctx.config
  const provider = ctx.config.ui.coverageProvider
  const providerReporter = (options.api?.port && options.coverage?.enabled)
    ? options.coverage.reporter.find((reporter) => {
      if (typeof reporter === 'string')
        return reporter === provider

      return reporter[0] === provider
    })
    : undefined

  if (!providerReporter)
    return undefined

  // reportsDirectory not resolved yet
  const root = resolve(
    ctx.config?.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
  )

  const subdir = (Array.isArray(providerReporter) && providerReporter.length > 1 && 'subdir' in providerReporter[1])
    ? providerReporter[1].subdir
    : undefined

  if (!subdir)
    return [root, `/${basename(root)}/`]

  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`]
}
