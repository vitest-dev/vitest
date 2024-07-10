import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { WorkspaceProject } from 'vitest/node'
import { getFilePoolName, resolveApiServerConfig, resolveFsAllow, distDir as vitestDist } from 'vitest/node'
import { type Plugin, coverageConfigDefaults } from 'vitest/config'
import { toArray } from '@vitest/utils'
import { defaultBrowserPort } from 'vitest/config'
import BrowserContext from './plugins/pluginContext'
import DynamicImport from './plugins/pluginDynamicImport'
import type { BrowserServer } from './server'
import { resolveOrchestrator } from './serverOrchestrator'
import { resolveTester } from './serverTester'

export type { BrowserCommand } from 'vitest/node'
export { defineBrowserCommand } from './commands/utils'

export default (browserServer: BrowserServer, base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')
  const project = browserServer.project

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async configureServer(server) {
        browserServer.setServer(server)

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
          if (!url.pathname.startsWith(browserServer.prefixTesterUrl) && url.pathname !== base) {
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
            const html = await resolveOrchestrator(browserServer, url, res)
            res.write(html, 'utf-8')
            res.end()
            return
          }

          const html = await resolveTester(browserServer, url, res)
          res.write(html, 'utf-8')
          res.end()
        })

        server.middlewares.use(
          `${base}favicon.svg`,
          (_, res) => {
            const content = readFileSync(resolve(distRoot, 'client/favicon.svg'))
            res.write(content, 'utf-8')
            res.end()
          },
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

        // replace env values - cannot be reassign at runtime
        const define: Record<string, string> = {}
        for (const env in (project.config.env || {})) {
          const stringValue = JSON.stringify(project.config.env[env])
          define[`process.env.${env}`] = stringValue
          define[`import.meta.env.${env}`] = stringValue
        }

        const entries: string[] = [
          ...browserTestFiles,
          ...setupFiles,
          resolve(vitestDist, 'index.js'),
          resolve(vitestDist, 'browser.js'),
          resolve(vitestDist, 'runners.js'),
          resolve(vitestDist, 'utils.js'),
          ...(project.config.snapshotSerializers || []),
        ]

        if (project.config.diff) {
          entries.push(project.config.diff)
        }

        if (project.ctx.coverageProvider) {
          const coverage = project.ctx.config.coverage
          const provider = coverage.provider
          if (provider === 'v8') {
            const path = tryResolve('@vitest/coverage-v8', [project.ctx.config.root])
            if (path) {
              entries.push(path)
            }
          }
          else if (provider === 'istanbul') {
            const path = tryResolve('@vitest/coverage-istanbul', [project.ctx.config.root])
            if (path) {
              entries.push(path)
            }
          }
          else if (provider === 'custom' && coverage.customProviderModule) {
            entries.push(coverage.customProviderModule)
          }
        }

        return {
          define,
          resolve: {
            dedupe: ['vitest'],
          },
          optimizeDeps: {
            entries,
            exclude: [
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/browser',
              '@vitest/browser/client',
              '@vitest/utils',
              '@vitest/utils/source-map',
              '@vitest/runner',
              '@vitest/spy',
              '@vitest/utils/error',
              '@vitest/snapshot',
              '@vitest/expect',
              'std-env',
              'tinybench',
              'tinyspy',
              'tinyrainbow',
              'pathe',
              'msw',
              'msw/browser',
            ],
            include: [
              'vitest > @vitest/snapshot > magic-string',
              'vitest > chai',
              'vitest > chai > loupe',
              'vitest > @vitest/utils > loupe',
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
        if (rawId === '/__vitest_msw__') {
          return this.resolve('msw/mockServiceWorker.js', distRoot, {
            skipSelf: true,
          })
        }
      },
    },
    {
      name: 'vitest:browser:assets',
      resolveId(id) {
        if (id.startsWith('/__vitest_browser__/') || id.startsWith('/__vitest__/')) {
          return resolve(distRoot, 'client', id.slice(1))
        }
      },
      transform(code, id) {
        if (id.includes(browserServer.vite.config.cacheDir) && id.includes('loupe.js')) {
          // loupe bundle has a nastry require('util') call that leaves a warning in the console
          const utilRequire = 'nodeUtil = require_util();'
          return code.replace(utilRequire, ' '.repeat(utilRequire.length))
        }
      },
    },
    BrowserContext(browserServer),
    DynamicImport(),
    {
      name: 'vitest:browser:config',
      enforce: 'post',
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        viteConfig.esbuild ||= {}
        viteConfig.esbuild.legalComments = 'inline'

        const server = resolveApiServerConfig(
          viteConfig.test?.browser || {},
          defaultBrowserPort,
        ) || {
          port: defaultBrowserPort,
        }

        // browser never runs in middleware mode
        server.middlewareMode = false

        viteConfig.server = {
          ...viteConfig.server,
          ...server,
          open: false,
        }
        viteConfig.server.fs ??= {}
        viteConfig.server.fs.allow = viteConfig.server.fs.allow || []
        viteConfig.server.fs.allow.push(
          ...resolveFsAllow(
            project.ctx.config.root,
            project.ctx.server.config.configFile,
          ),
        )

        return {
          resolve: {
            alias: viteConfig.test?.alias,
          },
        }
      },
    },
    // TODO: remove this when @testing-library/vue supports ESM
    {
      name: 'vitest:browser:support-testing-library',
      config() {
        return {
          define: {
            // testing-library/preact
            'process.env.PTL_SKIP_AUTO_CLEANUP': !!process.env.PTL_SKIP_AUTO_CLEANUP,
            // testing-library/react
            'process.env.RTL_SKIP_AUTO_CLEANUP': !!process.env.RTL_SKIP_AUTO_CLEANUP,
            'process.env?.RTL_SKIP_AUTO_CLEANUP': !!process.env.RTL_SKIP_AUTO_CLEANUP,
            // testing-library/svelte, testing-library/solid
            'process.env.STL_SKIP_AUTO_CLEANUP': !!process.env.STL_SKIP_AUTO_CLEANUP,
            // testing-library/vue
            'process.env.VTL_SKIP_AUTO_CLEANUP': !!process.env.VTL_SKIP_AUTO_CLEANUP,
            // dom.debug()
            'process.env.DEBUG_PRINT_LIMIT': process.env.DEBUG_PRINT_LIMIT || 7000,
          },
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: 'test-utils-rewrite',
                  setup(build) {
                    build.onResolve({ filter: /@vue\/test-utils/ }, (args) => {
                      const _require = getRequire()
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

function tryResolve(path: string, paths: string[]) {
  try {
    const _require = getRequire()
    return _require.resolve(path, { paths })
  }
  catch {
    return undefined
  }
}

let _require: NodeRequire
function getRequire() {
  if (!_require) {
    _require = createRequire(import.meta.url)
  }
  return _require
}

function resolveCoverageFolder(project: WorkspaceProject) {
  const options = project.ctx.config
  const htmlReporter = options.coverage?.enabled
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
