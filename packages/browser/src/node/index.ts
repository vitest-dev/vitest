import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { WorkspaceProject } from 'vitest/node'
import { getFilePoolName, distDir as vitestDist } from 'vitest/node'
import { type Plugin, coverageConfigDefaults } from 'vitest/config'
import { toArray } from '@vitest/utils'
import BrowserContext from './plugins/pluginContext'
import DynamicImport from './plugins/pluginDynamicImport'
import { BrowserServerState } from './state'
import { resolveOrchestrator } from './serverOrchestrator'
import { resolveTester } from './serverTester'

export type { BrowserCommand } from 'vitest/node'
export { defineBrowserCommand } from './commands/utils'

export default (project: WorkspaceProject, base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        if (viteConfig.esbuild !== false) {
          viteConfig.esbuild ||= {}
          viteConfig.esbuild.legalComments = 'inline'
        }
      },
      async configureServer(server) {
        const state = new BrowserServerState(
          project,
          server,
          base,
        )
        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(function vitestHeaders(_req, res, next) {
          const headers = server.config.server.headers
          if (headers) {
            for (const name in headers) {
              res.setHeader(name, headers[name]!)
            }
          }
          next()
        })
        // eslint-disable-next-line prefer-arrow-callback
        server.middlewares.use(async function vitestBrowserMode(req, res, next) {
          if (!req.url) {
            return next()
          }
          const url = new URL(req.url, 'http://localhost')
          if (!url.pathname.startsWith(state.prefixTesterUrl) && url.pathname !== base) {
            return next()
          }

          res.setHeader(
            'Cache-Control',
            'no-cache, max-age=0, must-revalidate',
          )
          res.setHeader('Content-Type', 'text/html; charset=utf-8')

          // remove custom iframe related headers to allow the iframe to load
          res.removeHeader('X-Frame-Options')

          if (url.pathname === base) {
            const html = await resolveOrchestrator(state, url, res)
            res.write(html, 'utf-8')
            res.end()
            return
          }

          const html = await resolveTester(state, url, res)
          res.write(html, 'utf-8')
          res.end()
        })
        server.middlewares.use(
          base,
          sirv(resolve(distRoot, 'client'), {
            single: false,
            dev: true,
          }),
        )

        const coverageFolder = resolveCoverageFolder(project)
        const coveragePath = coverageFolder ? coverageFolder[1] : undefined
        if (coveragePath && base === coveragePath) {
          throw new Error(
            `The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`,
          )
        }

        coverageFolder && server.middlewares.use(
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
      },
    },
    {
      name: 'vitest:browser:tests',
      enforce: 'pre',
      async config() {
        const allTestFiles = await project.globTestFiles()
        const browserTestFiles = allTestFiles.filter(
          file => getFilePoolName(project, file) === 'browser',
        )
        const setupFiles = toArray(project.config.setupFiles)
        return {
          optimizeDeps: {
            entries: [
              ...browserTestFiles,
              ...setupFiles,
              resolve(vitestDist, 'index.js'),
              resolve(vitestDist, 'browser.js'),
              resolve(vitestDist, 'runners.js'),
              resolve(vitestDist, 'utils.js'),
            ],
            exclude: [
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',
              '@vitest/runner',
              '@vitest/spy',
              '@vitest/utils/error',
              '@vitest/utils/source-map',
              '@vitest/snapshot',
              '@vitest/expect',
              'std-env',
              'tinybench',
              'tinyspy',
              'pathe',
              'msw',
              'msw/browser',
            ],
            include: [
              'vitest > @vitest/utils > pretty-format',
              'vitest > @vitest/snapshot > pretty-format',
              'vitest > @vitest/snapshot > magic-string',
              'vitest > pretty-format',
              'vitest > pretty-format > ansi-styles',
              'vitest > pretty-format > ansi-regex',
              'vitest > chai',
              'vitest > chai > loupe',
              'vitest > @vitest/runner > p-limit',
              'vitest > @vitest/utils > diff-sequences',
              '@vitest/browser > @testing-library/user-event',
              '@vitest/browser > @testing-library/dom',
            ],
          },
        }
      },
      async resolveId(id) {
        if (!/\?browserv=\w+$/.test(id)) {
          return
        }

        let useId = id.slice(0, id.lastIndexOf('?'))
        if (useId.startsWith('/@fs/')) {
          useId = useId.slice(5)
        }

        if (/^\w:/.test(useId)) {
          useId = useId.replace(/\\/g, '/')
        }

        return useId
      },
    },
    {
      name: 'vitest:browser:resolve-virtual',
      async resolveId(rawId) {
        if (rawId.startsWith('/__virtual_vitest__:')) {
          let id = rawId.slice('/__virtual_vitest__:'.length)
          // TODO: don't hardcode
          if (id === 'mocker-worker.js') {
            id = 'msw/mockServiceWorker.js'
          }

          const resolved = await this.resolve(id, distRoot, {
            skipSelf: true,
          })
          return resolved
        }
      },
    },
    BrowserContext(project),
    DynamicImport(),
    // TODO: remove this when @testing-library/vue supports ESM
    {
      name: 'vitest:browser:support-vue-testing-library',
      config() {
        return {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: 'test-utils-rewrite',
                  setup(build) {
                    const _require = createRequire(import.meta.url)
                    build.onResolve({ filter: /@vue\/test-utils/ }, (args) => {
                      // resolve to CJS instead of the browser because the browser version expects a global Vue object
                      const resolved = _require.resolve(args.path, {
                        paths: [args.importer],
                      })
                      return { path: resolved }
                    })
                  },
                },
              ],
            },
          },
        }
      },
    },
  ]
}

function resolveCoverageFolder(project: WorkspaceProject) {
  const options = project.ctx.config
  const htmlReporter = options.coverage?.enabled
    ? options.coverage.reporter.find((reporter) => {
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
    options.root || process.cwd(),
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
