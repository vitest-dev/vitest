import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import type { Vitest } from 'vitest'
import { resolveCoverageFolder, transformCoverageEntryPoint } from './utils'

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
        const base = readFile(resolve(root, '../istanbul-base.css'))
        const prettify = readFile(resolve(root, '../istanbul-prettify.css'))
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
