import { fileURLToPath } from 'node:url'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import { coverageConfigDefaults } from 'vitest/config'
import type { Vitest, VitestServerConnection } from 'vitest/node'

export default (ctx: Vitest, connection: VitestServerConnection) => {
  const uiOptions = ctx.config
  const base = uiOptions.uiBase
  const coverageFolder = resolveCoverageFolder(ctx)
  const coveragePath = coverageFolder ? coverageFolder[1] : undefined
  if (coveragePath && base === coveragePath)
    throw new Error(`The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`)

  coverageFolder && connection.middlewares.use(coveragePath!, sirv(coverageFolder[0], {
    single: true,
    dev: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
    },
  }))
  const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
  connection.middlewares.use(base, sirv(clientDist, {
    single: true,
    dev: true,
  }))
}

function resolveCoverageFolder(ctx: Vitest) {
  const options = ctx.config
  const htmlReporter = (options.api?.port && options.coverage?.enabled)
    ? options.coverage.reporter.find((reporter) => {
      if (typeof reporter === 'string')
        return reporter === 'html'

      return reporter[0] === 'html'
    })
    : undefined

  if (!htmlReporter)
    return undefined

  // reportsDirectory not resolved yet
  const root = resolve(
    ctx.config?.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
  )

  const subdir = (Array.isArray(htmlReporter) && htmlReporter.length > 1 && 'subdir' in htmlReporter[1])
    ? htmlReporter[1].subdir
    : undefined

  if (!subdir || typeof subdir !== 'string')
    return [root, `/${basename(root)}/`]

  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`]
}
