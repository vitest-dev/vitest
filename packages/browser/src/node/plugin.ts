import type { Stats } from 'node:fs'
import type { WorkspaceProject } from 'vitest/node'
import type { BrowserServer } from './server'
import { lstatSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dynamicImportPlugin } from '@vitest/mocker/node'
import { toArray } from '@vitest/utils'
import MagicString from 'magic-string'
import { basename, dirname, extname, resolve } from 'pathe'
import sirv from 'sirv'
import { coverageConfigDefaults, type Plugin } from 'vitest/config'
import { getFilePoolName, resolveApiServerConfig, resolveFsAllow, distDir as vitestDist } from 'vitest/node'
import { distRoot } from './constants'
import BrowserContext from './plugins/pluginContext'
import { resolveOrchestrator } from './serverOrchestrator'
import { resolveTester } from './serverTester'

export { defineBrowserCommand } from './commands/utils'
export type { BrowserCommand } from 'vitest/node'

const versionRegexp = /(?:\?|&)v=\w{8}/

export default (browserServer: BrowserServer, base = '/'): Plugin[] => {
  const project = browserServer.project

  function isPackageExists(pkg: string, root: string) {
    return browserServer.project.ctx.packageInstaller.isPackageExists?.(pkg, {
      paths: [root],
    })
  }

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
          if (!req.url || !browserServer.provider) {
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

        const screenshotFailures = project.config.browser.ui && project.config.browser.screenshotFailures

        if (screenshotFailures) {
        // eslint-disable-next-line prefer-arrow-callback
          server.middlewares.use(`${base}__screenshot-error`, function vitestBrowserScreenshotError(req, res) {
            if (!req.url || !browserServer.provider) {
              res.statusCode = 404
              res.end()
              return
            }

            const url = new URL(req.url, 'http://localhost')
            const file = url.searchParams.get('file')
            if (!file) {
              res.statusCode = 404
              res.end()
              return
            }

            let stat: Stats | undefined
            try {
              stat = lstatSync(file)
            }
            catch {
            }

            if (!stat?.isFile()) {
              res.statusCode = 404
              res.end()
              return
            }

            const ext = extname(file)
            const buffer = readFileSync(file)
            res.setHeader(
              'Cache-Control',
              'public,max-age=0,must-revalidate',
            )
            res.setHeader('Content-Length', buffer.length)
            res.setHeader('Content-Type', ext === 'jpeg' || ext === 'jpg'
              ? 'image/jpeg'
              : ext === 'webp'
                ? 'image/webp'
                : 'image/png')
            res.end(buffer)
          })
        }
        server.middlewares.use((req, res, next) => {
          // 9000 mega head move
          // Vite always caches optimized dependencies, but users might mock
          // them in _some_ tests, while keeping original modules in others
          // there is no way to configure that in Vite, so we patch it here
          // to always ignore the cache-control set by Vite in the next middleware
          if (req.url && versionRegexp.test(req.url) && !req.url.includes('chunk-')) {
            res.setHeader('Cache-Control', 'no-cache')
            const setHeader = res.setHeader.bind(res)
            res.setHeader = function (name, value) {
              if (name === 'Cache-Control') {
                return res
              }
              return setHeader(name, value)
            }
          }
          next()
        })
      },
    },
    {
      name: 'vitest:browser:tests',
      enforce: 'pre',
      async config() {
        const { testFiles: allTestFiles } = await project.globTestFiles()
        const browserTestFiles = allTestFiles.filter(
          file => getFilePoolName(project, file) === 'browser',
        )
        const setupFiles = toArray(project.config.setupFiles)

        // replace env values - cannot be reassign at runtime
        const define: Record<string, string> = {}
        for (const env in (project.config.env || {})) {
          const stringValue = JSON.stringify(project.config.env[env])
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

        const exclude = [
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
        ]

        if (project.config.diff) {
          entries.push(project.config.diff)
        }

        if (project.ctx.coverageProvider) {
          const coverage = project.ctx.config.coverage
          const provider = coverage.provider
          if (provider === 'v8') {
            const path = tryResolve('@vitest/coverage-v8', [project.config.root])
            if (path) {
              entries.push(path)
              exclude.push('@vitest/coverage-v8/browser')
            }
          }
          else if (provider === 'istanbul') {
            const path = tryResolve('@vitest/coverage-istanbul', [project.config.root])
            if (path) {
              entries.push(path)
              exclude.push('@vitest/coverage-istanbul')
            }
          }
          else if (provider === 'custom' && coverage.customProviderModule) {
            entries.push(coverage.customProviderModule)
          }
        }

        const include = [
          'vitest > expect-type',
          'vitest > @vitest/snapshot > magic-string',
          'vitest > chai',
          'vitest > chai > loupe',
          'vitest > @vitest/utils > loupe',
          '@vitest/browser > @testing-library/user-event',
          '@vitest/browser > @testing-library/dom',
        ]

        const fileRoot = browserTestFiles[0] ? dirname(browserTestFiles[0]) : project.config.root

        const svelte = isPackageExists('vitest-browser-svelte', fileRoot)
        if (svelte) {
          exclude.push('vitest-browser-svelte')
        }

        // since we override the resolution in the esbuild plugin, Vite can no longer optimizer it
        // have ?. until Vitest 3.0 for backwards compatibility
        const vueTestUtils = isPackageExists('@vue/test-utils', fileRoot)
        if (vueTestUtils) {
          include.push('@vue/test-utils')
        }

        return {
          define,
          resolve: {
            dedupe: ['vitest'],
          },
          optimizeDeps: {
            entries,
            exclude,
            include,
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
        if (rawId === '/mockServiceWorker.js') {
          return this.resolve('msw/mockServiceWorker.js', distRoot, {
            skipSelf: true,
          })
        }
      },
    },
    {
      name: 'vitest:browser:assets',
      configureServer(server) {
        server.middlewares.use(
          '/__vitest__',
          sirv(resolve(distRoot, 'client/__vitest__')),
        )
      },
      resolveId(id) {
        if (id.startsWith('/__vitest_browser__/')) {
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
    dynamicImportPlugin({
      globalThisAccessor: '"__vitest_browser_runner__"',
      filter(id) {
        if (id.includes(distRoot)) {
          return false
        }
        return true
      },
    }),
    {
      name: 'vitest:browser:config',
      enforce: 'post',
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        if (viteConfig.esbuild !== false) {
          viteConfig.esbuild ||= {}
          viteConfig.esbuild.legalComments = 'inline'
        }

        const defaultPort = project.ctx._browserLastPort++

        const api = resolveApiServerConfig(
          viteConfig.test?.browser || {},
          defaultPort,
        )

        viteConfig.server = {
          ...viteConfig.server,
          port: defaultPort,
          ...api,
          middlewareMode: false,
          open: false,
        }
        viteConfig.server.fs ??= {}
        viteConfig.server.fs.allow = viteConfig.server.fs.allow || []
        viteConfig.server.fs.allow.push(
          ...resolveFsAllow(
            project.ctx.config.root,
            project.ctx.server.config.configFile,
          ),
          distRoot,
        )

        return {
          resolve: {
            alias: viteConfig.test?.alias,
          },
        }
      },
    },
    {
      name: 'vitest:browser:in-source-tests',
      transform(code, id) {
        if (!project.isTestFile(id) || !code.includes('import.meta.vitest')) {
          return
        }
        const s = new MagicString(code, { filename: cleanUrl(id) })
        s.prepend(
          `import.meta.vitest = __vitest_index__;\n`,
        )
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      },
    },
    {
      name: 'vitest:browser:worker',
      transform(code, id, _options) {
        // https://github.com/vitejs/vite/blob/ba56cf43b5480f8519349f7d7fe60718e9af5f1a/packages/vite/src/node/plugins/worker.ts#L46
        if (/(?:\?|&)worker_file&type=\w+(?:&|$)/.test(id)) {
          const s = new MagicString(code)
          s.prepend('globalThis.__vitest_browser_runner__ = { wrapDynamicImport: f => f() };\n')
          return {
            code: s.toString(),
            map: s.generateMap({ hires: 'boundary' }),
          }
        }
      },
    },
    {
      name: 'vitest:browser:support-testing-library',
      config() {
        return {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: 'test-utils-rewrite',
                  setup(build) {
                    build.onResolve({ filter: /^@vue\/test-utils$/ }, (args) => {
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

const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
