import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { coverageConfigDefaults } from 'vitest/config'
import type { Vitest } from 'vitest'
import { toArray } from '@vitest/utils'
import { transformCoverageEntryPoint } from './utils'

export default (ctx: Vitest): Plugin => {
  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configureServer(server) {
      const uiOptions = ctx.config
      const base = uiOptions.uiBase
      const coverageFolder = resolveCoverageFolder(ctx)
      const coveragePath = coverageFolder ? coverageFolder[1] : undefined
      if (coveragePath && base === coveragePath) {
        throw new Error(
          `The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`,
        )
      }

      if (coverageFolder) {
        const root = resolve(fileURLToPath(import.meta.url), '../')
        const base = readFile(resolve(root, '../istambul-base.css'))
        const prettify = readFile(resolve(root, '../istambul-prettify.css'))
        server.middlewares.use(coveragePath!, async (req, res, next) => {
          if (!req.url) {
            return next()
          }

          const pathname = new URL(req.url, 'http://localhost').pathname
          if (pathname !== '/' && pathname !== '/index.html' && pathname !== '/base.css' && pathname !== '/prettify.css' && !pathname.endsWith('.html')) {
            return next()
          }

          if (pathname === '/base.css') {
            res.setHeader('Content-Type', 'text/css')
            res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
            res.end(await base)
            // for testing purposes: don't remove it
            // res.end(await readFile(resolve(fileURLToPath(import.meta.url), '../../istambul-base.css')))
            return
          }

          if (pathname === '/prettify.css') {
            res.setHeader('Content-Type', 'text/css')
            res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
            res.end(await prettify)
            // for testing purposes: don't remove it
            // res.end(await readFile(resolve(fileURLToPath(import.meta.url), '../../istambul-prettify.css')))
            return
          }

          const file = pathname.endsWith('.html')
            ? pathname[0] === '/' ? pathname.slice(1) : pathname
            : 'index.html'

          const indexHtml = await readFile(resolve(coverageFolder[0], file), 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
          res.end(transformCoverageEntryPoint(indexHtml))
        })
        server.middlewares.use(
          coveragePath!,
          sirv(coverageFolder[0], {
            single: true,
            dev: true,
            setHeaders: (res) => {
              res.setHeader(
                'Cache-Control',
                'public,max-age=0,must-revalidate',
              )
            },
          }),
        )
      }

      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      server.middlewares.use(
        base,
        sirv(clientDist, {
          single: true,
          dev: true,
        }),
      )
    },
  }
}

function resolveCoverageFolder(ctx: Vitest) {
  const options = ctx.config
  const htmlReporter
    = options.api?.port && options.coverage?.enabled
      ? toArray(options.coverage.reporter).find((reporter) => {
        if (typeof reporter === 'string') {
          return reporter === 'html'
        }

        return reporter[0] === 'html'
      })
      : undefined

  if (!htmlReporter) {
    return undefined
  }

  // reportsDirectory not resolved yet
  const root = resolve(
    ctx.config?.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
  )

  const subdir
    = Array.isArray(htmlReporter)
    && htmlReporter.length > 1
    && 'subdir' in htmlReporter[1]
      ? htmlReporter[1].subdir
      : undefined

  if (!subdir || typeof subdir !== 'string') {
    return [root, `/${basename(root)}/`]
  }

  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`]
}
