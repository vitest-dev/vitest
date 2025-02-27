import type { Plugin } from 'vite'
import type { Vitest } from 'vitest/node'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { toArray } from '@vitest/utils'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import c from 'tinyrainbow'
import { coverageConfigDefaults } from 'vitest/config'
import { version } from '../package.json'

export default (ctx: Vitest): Plugin => {
  if (ctx.version !== version) {
    ctx.logger.warn(
      c.yellow(
        `Loaded ${c.inverse(c.yellow(` vitest@${ctx.version} `))} and ${c.inverse(c.yellow(` @vitest/ui@${version} `))}.`
        + '\nRunning mixed versions is not supported and may lead into bugs'
        + '\nUpdate your dependencies and make sure the versions match.',
      ),
    )
  }

  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configureServer: {
      order: 'post',
      handler(server) {
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
        const clientIndexHtml = fs.readFileSync(resolve(clientDist, 'index.html'), 'utf-8')

        // serve index.html with api token
        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(function vitestUiHtmlMiddleware(req, res, next) {
          if (req.url) {
            const url = new URL(req.url, 'http://localhost')
            if (url.pathname === base) {
              const html = clientIndexHtml.replace(
                '<!-- !LOAD_METADATA! -->',
                `<script>window.VITEST_API_TOKEN = ${JSON.stringify(ctx.config.api.token)}</script>`,
              )
              res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate')
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.write(html)
              res.end()
              return
            }
          }
          next()
        })

        server.middlewares.use(
          base,
          sirv(clientDist, {
            single: true,
            dev: true,
          }),
        )
      },
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
