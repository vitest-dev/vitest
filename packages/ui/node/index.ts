import type { IncomingMessage } from 'node:http'
import type { PluginHarness, Vite } from 'vitest/node'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { join, resolve } from 'pathe'
import sirv from 'sirv'
import c from 'tinyrainbow'
import { isFileServingAllowed, isValidApiRequest } from 'vitest/node'
import { version } from '../package.json'
import { distClientRoot, resolvePlaywrightTraceViewerRoot } from './paths'

export { distClientRoot }

const UI_TOKEN_COOKIE = 'vitest-ui-token'
const AUTH_REQUIRED_MESSAGE = 'Vitest UI requires authentication. Open the URL with the token printed in the terminal, e.g. http://localhost:51204/__vitest__/?token=...'

export default (harness: PluginHarness): Vite.Plugin => {
  if (harness.version !== version) {
    harness.logger.warn(
      c.yellow(
        `Loaded ${c.inverse(c.yellow(` vitest@${harness.version} `))} and ${c.inverse(c.yellow(` @vitest/ui@${version} `))}.`
        + '\nRunning mixed versions is not supported and may lead into bugs'
        + '\nUpdate your dependencies and make sure the versions match.',
      ),
    )
  }

  return <Vite.Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configureServer: {
      order: 'post',
      handler(server) {
        const ctx = harness.getVitest()
        const uiOptions = ctx.config
        const base = uiOptions.uiBase

        function serializeTokenCookie(): string {
          return serializeCookie(UI_TOKEN_COOKIE, ctx.config.api.token, {
            path: base,
            httpOnly: true,
            sameSite: 'strict',
          })
        }

        function hasValidTokenCookie(req: IncomingMessage): boolean {
          const cookieToken = parseCookie(req.headers.cookie ?? '')[UI_TOKEN_COOKIE]
          if (!cookieToken) {
            return false
          }
          try {
            return crypto.timingSafeEqual(
              Buffer.from(cookieToken),
              Buffer.from(ctx.config.api.token),
            )
          }
          catch {
            return false
          }
        }

        // Authenticate the whole UI subtree in one place. Mounted on `base` so
        // Connect matches it exactly like the static handlers below, which it
        // routes case-insensitively and on `.`/`/` boundaries; a pathname
        // comparison here would diverge and be bypassable (e.g. /__vitest__/Coverage).
        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(base, function vitestUiAuth(req, res, next) {
          // a valid `?token=` bootstraps the cookie so later cookie-only
          // requests (the coverage iframe and its child assets) stay authorized
          if (isValidApiRequest(ctx.config, req)) {
            res.setHeader('Set-Cookie', serializeTokenCookie())
            return next()
          }
          if (hasValidTokenCookie(req)) {
            return next()
          }
          res.statusCode = 403
          res.end(AUTH_REQUIRED_MESSAGE)
        })

        // Serve coverage HTML at ./coverage if configured
        const coverageHtmlDir = ctx.config.coverage?.htmlDir
        if (coverageHtmlDir) {
          server.middlewares.use(
            join(base, 'coverage'),
            sirv(coverageHtmlDir, {
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

        const playwrightTraceViewerRoot = resolvePlaywrightTraceViewerRoot(ctx.config.root)
        if (playwrightTraceViewerRoot) {
          server.middlewares.use(
            join(base, 'trace'),
            sirv(playwrightTraceViewerRoot, { dev: true }),
          )
        }

        const clientIndexHtml = fs.readFileSync(resolve(distClientRoot, 'index.html'), 'utf-8')

        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(function vitestAttachment(req, res, next) {
          if (!req.url) {
            return next()
          }

          const url = new URL(req.url, 'http://localhost')
          if (url.pathname === '/__vitest_attachment__') {
            const path = url.searchParams.get('path')
            const contentType = url.searchParams.get('contentType')

            // ignore invalid requests
            if (!isValidApiRequest(ctx.config, req) || !contentType || !path) {
              return next()
            }

            const fsPath = decodeURIComponent(path)

            if (!isFileServingAllowed(ctx.viteConfig, fsPath)) {
              return next()
            }

            try {
              res.writeHead(200, {
                'content-type': contentType,
              })
              fs.createReadStream(fsPath)
                .pipe(res)
                .on('close', () => res.end())
            }
            catch (err) {
              next(err)
            }
          }
          else {
            next()
          }
        })

        // serve index.html with api token
        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(function vitestUiHtmlMiddleware(req, res, next) {
          if (req.url) {
            const url = new URL(req.url, 'http://localhost')
            if (url.pathname === base) {
              // vitestUiAuth already validated the request and set the cookie;
              // redirect to strip the token from the URL
              if (isValidApiRequest(ctx.config, req)) {
                res.statusCode = 302
                res.setHeader('Location', base)
                res.end()
                return
              }
              const html = clientIndexHtml.replace(
                '<!-- !LOAD_METADATA! -->',
                `<script>window.VITEST_API_TOKEN = ${JSON.stringify(ctx.config.api.token)}</script>`,
              )
              res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate')
              res.setHeader('Referrer-Policy', 'no-referrer')
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
          sirv(distClientRoot, {
            single: true,
            dev: true,
          }),
        )
      },
    },
  }
}
