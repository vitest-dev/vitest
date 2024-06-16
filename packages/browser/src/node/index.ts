import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, join, resolve } from 'pathe'
import sirv from 'sirv'
import type { ViteDevServer } from 'vite'
import type { ResolvedConfig } from 'vitest'
import type { BrowserScript, WorkspaceProject } from 'vitest/node'
import { getFilePoolName, distDir as vitestDist } from 'vitest/node'
import { type Plugin, coverageConfigDefaults } from 'vitest/config'
import { slash, toArray } from '@vitest/utils'
import BrowserContext from './plugins/pluginContext'
import DynamicImport from './plugins/pluginDynamicImport'

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
        const testerHtml = readFile(
          resolve(distRoot, 'client/tester.html'),
          'utf8',
        )
        const orchestratorHtml = project.config.browser.ui
          ? readFile(resolve(distRoot, 'client/__vitest__/index.html'), 'utf8')
          : readFile(resolve(distRoot, 'client/orchestrator.html'), 'utf8')
        const injectorJs = readFile(
          resolve(distRoot, 'client/esm-client-injector.js'),
          'utf8',
        )
        const manifest = (async () => {
          return JSON.parse(
            await readFile(`${distRoot}/client/.vite/manifest.json`, 'utf8'),
          )
        })()
        const favicon = `${base}favicon.svg`
        const testerPrefix = `${base}__vitest_test__/__test__/`
        server.middlewares.use((_req, res, next) => {
          const headers = server.config.server.headers
          if (headers) {
            for (const name in headers) {
              res.setHeader(name, headers[name]!)
            }
          }
          next()
        })
        let orchestratorScripts: string | undefined
        let testerScripts: string | undefined
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) {
            return next()
          }
          const url = new URL(req.url, 'http://localhost')
          if (!url.pathname.startsWith(testerPrefix) && url.pathname !== base) {
            return next()
          }

          res.setHeader(
            'Cache-Control',
            'no-cache, max-age=0, must-revalidate',
          )
          res.setHeader('Content-Type', 'text/html; charset=utf-8')

          const config = wrapConfig(project.getSerializableConfig())
          config.env ??= {}
          config.env.VITEST_BROWSER_DEBUG
            = process.env.VITEST_BROWSER_DEBUG || ''

          // remove custom iframe related headers to allow the iframe to load
          res.removeHeader('X-Frame-Options')

          if (url.pathname === base) {
            let contextId = url.searchParams.get('contextId')
            // it's possible to open the page without a context,
            // for now, let's assume it should be the first one
            if (!contextId) {
              contextId = project.browserState.keys().next().value ?? 'none'
            }

            const files = project.browserState.get(contextId!)?.files ?? []

            const injector = replacer(await injectorJs, {
              __VITEST_CONFIG__: JSON.stringify(config),
              __VITEST_VITE_CONFIG__: JSON.stringify({
                root: project.browser!.config.root,
              }),
              __VITEST_FILES__: JSON.stringify(files),
              __VITEST_TYPE__:
                url.pathname === base ? '"orchestrator"' : '"tester"',
              __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
            })

            // disable CSP for the orchestrator as we are the ones controlling it
            res.removeHeader('Content-Security-Policy')

            if (!orchestratorScripts) {
              orchestratorScripts = await formatScripts(
                project.config.browser.orchestratorScripts,
                server,
              )
            }

            let baseHtml = await orchestratorHtml

            // if UI is enabled, use UI HTML and inject the orchestrator script
            if (project.config.browser.ui) {
              const manifestContent = await manifest
              const jsEntry = manifestContent['orchestrator.html'].file
              baseHtml = baseHtml
                .replaceAll('./assets/', `${base}__vitest__/assets/`)
                .replace(
                  '<!-- !LOAD_METADATA! -->',
                  [
                    '<script>{__VITEST_INJECTOR__}</script>',
                    '{__VITEST_SCRIPTS__}',
                    `<script type="module" crossorigin src="${jsEntry}"></script>`,
                  ].join('\n'),
                )
            }

            const html = replacer(baseHtml, {
              __VITEST_FAVICON__: favicon,
              __VITEST_TITLE__: 'Vitest Browser Runner',
              __VITEST_SCRIPTS__: orchestratorScripts,
              __VITEST_INJECTOR__: injector,
              __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
            })
            res.write(html, 'utf-8')
            res.end()
            return
          }

          const csp = res.getHeader('Content-Security-Policy')
          if (typeof csp === 'string') {
            // add frame-ancestors to allow the iframe to be loaded by Vitest,
            // but keep the rest of the CSP
            res.setHeader(
              'Content-Security-Policy',
              csp.replace(/frame-ancestors [^;]+/, 'frame-ancestors *'),
            )
          }

          const [contextId, testFile] = url.pathname
            .slice(testerPrefix.length)
            .split('/')
          const decodedTestFile = decodeURIComponent(testFile)
          const testFiles = await project.globTestFiles()
          // if decoded test file is "__vitest_all__" or not in the list of known files, run all tests
          const tests
            = decodedTestFile === '__vitest_all__'
            || !testFiles.includes(decodedTestFile)
              ? '__vitest_browser_runner__.files'
              : JSON.stringify([decodedTestFile])
          const iframeId = JSON.stringify(decodedTestFile)
          const files = project.browserState.get(contextId)?.files ?? []

          const injector = replacer(await injectorJs, {
            __VITEST_CONFIG__: JSON.stringify(config),
            __VITEST_FILES__: JSON.stringify(files),
            __VITEST_VITE_CONFIG__: JSON.stringify({
              root: project.browser!.config.root,
            }),
            __VITEST_TYPE__:
              url.pathname === base ? '"orchestrator"' : '"tester"',
            __VITEST_CONTEXT_ID__: JSON.stringify(contextId),
          })

          if (!testerScripts) {
            testerScripts = await formatScripts(
              project.config.browser.testerScripts,
              server,
            )
          }

          const html = replacer(await testerHtml, {
            __VITEST_FAVICON__: favicon,
            __VITEST_TITLE__: 'Vitest Browser Tester',
            __VITEST_SCRIPTS__: testerScripts,
            __VITEST_INJECTOR__: injector,
            __VITEST_APPEND__:
              // TODO: have only a single global variable to not pollute the global scope
              `<script type="module">
  __vitest_browser_runner__.runningFiles = ${tests}
  __vitest_browser_runner__.iframeId = ${iframeId}
  __vitest_browser_runner__.runTests(__vitest_browser_runner__.runningFiles)
</script>`,
          })
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

        coverageFolder
        && server.middlewares.use(
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
        const vitestPaths = [
          resolve(vitestDist, 'index.js'),
          resolve(vitestDist, 'browser.js'),
          resolve(vitestDist, 'runners.js'),
          resolve(vitestDist, 'utils.js'),
        ]
        return {
          optimizeDeps: {
            entries: [...browserTestFiles, ...setupFiles, ...vitestPaths],
            exclude: [
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',
              '@vitest/runner',
              '@vitest/spy',
              '@vitest/utils/error',
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

function wrapConfig(config: ResolvedConfig): ResolvedConfig {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern: config.testNamePattern
      ? (config.testNamePattern.toString() as any as RegExp)
      : undefined,
  }
}

function replacer(code: string, values: Record<string, string>) {
  return code.replace(/\{\s*(\w+)\s*\}/g, (_, key) => values[key] ?? '')
}

async function formatScripts(
  scripts: BrowserScript[] | undefined,
  server: ViteDevServer,
) {
  if (!scripts?.length) {
    return ''
  }
  const promises = scripts.map(
    async ({ content, src, async, id, type = 'module' }, index) => {
      const srcLink
        = (src ? (await server.pluginContainer.resolveId(src))?.id : undefined)
        || src
      const transformId
        = srcLink
        || join(server.config.root, `virtual__${id || `injected-${index}.js`}`)
      await server.moduleGraph.ensureEntryFromUrl(transformId)
      const contentProcessed
        = content && type === 'module'
          ? (await server.pluginContainer.transform(content, transformId)).code
          : content
      return `<script type="${type}"${async ? ' async' : ''}${
        srcLink ? ` src="${slash(`/@fs/${srcLink}`)}"` : ''
      }>${contentProcessed || ''}</script>`
    },
  )
  return (await Promise.all(promises)).join('\n')
}
