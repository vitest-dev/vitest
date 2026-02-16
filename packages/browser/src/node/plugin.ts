import type { HtmlTagDescriptor } from 'vite'
import type { Plugin } from 'vitest/config'
import type { ParentBrowserProject } from './projectParent'
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dynamicImportPlugin } from '@vitest/mocker/node'
import { toArray } from '@vitest/utils/helpers'
import MagicString from 'magic-string'
import { dirname, join, resolve } from 'pathe'
import sirv from 'sirv'
import {
  isFileServingAllowed,
  isValidApiRequest,
  resolveApiServerConfig,
  resolveFsAllow,
  rolldownVersion,
  distDir as vitestDist,
} from 'vitest/node'
import { distRoot } from './constants'
import { createOrchestratorMiddleware } from './middlewares/orchestratorMiddleware'
import { createTesterMiddleware } from './middlewares/testerMiddleware'
import BrowserContext from './plugins/pluginContext'

export type { BrowserCommand } from 'vitest/node'

const versionRegexp = /(?:\?|&)v=\w{8}/

export default (parentServer: ParentBrowserProject, base = '/'): Plugin[] => {
  function isPackageExists(pkg: string, root: string) {
    return parentServer.vitest.packageInstaller.isPackageExists?.(pkg, {
      paths: [root],
    })
  }

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async configureServer(server) {
        parentServer.setServer(server)

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
        server.middlewares.use(createOrchestratorMiddleware(parentServer))
        server.middlewares.use(createTesterMiddleware(parentServer))

        server.middlewares.use(
          `${base}favicon.svg`,
          (_, res) => {
            const content = readFileSync(resolve(distRoot, 'client/favicon.svg'))
            res.write(content, 'utf-8')
            res.end()
          },
        )

        // Serve coverage HTML at ./coverage if configured
        const coverageHtmlDir = parentServer.vitest.config.coverage?.htmlDir
        if (coverageHtmlDir) {
          server.middlewares.use(
            '/__vitest_test__/coverage',
            sirv(coverageHtmlDir, {
              single: true,
              dev: true,
              setHeaders: (res) => {
                const csp = res.getHeader('Content-Security-Policy')
                if (typeof csp === 'string') {
                  // add frame-ancestors to allow the iframe to be loaded by Vitest,
                  // but keep the rest of the CSP
                  res.setHeader(
                    'Content-Security-Policy',
                    csp.replace(/frame-ancestors [^;]+/, 'frame-ancestors *'),
                  )
                }
                res.setHeader(
                  'Cache-Control',
                  'public,max-age=0,must-revalidate',
                )
              },
            }),
          )
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
        // handle attachments the same way as in packages/ui/node/index.ts
        server.middlewares.use((req, res, next) => {
          if (!req.url) {
            return next()
          }

          const url = new URL(req.url, 'http://localhost')

          if (url.pathname !== '/__vitest_attachment__') {
            return next()
          }

          const path = url.searchParams.get('path')
          const contentType = url.searchParams.get('contentType')

          if (!isValidApiRequest(parentServer.config, req) || !contentType || !path) {
            return next()
          }

          const fsPath = decodeURIComponent(path)

          if (!isFileServingAllowed(parentServer.vite.config, fsPath)) {
            return next()
          }

          try {
            res.setHeader(
              'content-type',
              contentType,
            )

            return createReadStream(fsPath)
              .pipe(res)
              .on('close', () => res.end())
          }
          catch (err) {
            return next(err)
          }
        })
      },
    },
    {
      name: 'vitest:browser:tests',
      enforce: 'pre',
      async config() {
        // this plugin can be used in different projects, but all of them
        // have the same `include` pattern, so it doesn't matter which project we use
        const project = parentServer.project
        const { testFiles: browserTestFiles } = await project.globTestFiles()
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
          'vitest/browser',
          'vitest/internal/browser',
          'vite/module-runner',
          '@vitest/browser/utils',
          '@vitest/browser/context',
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

        if (typeof project.config.diff === 'string') {
          entries.push(project.config.diff)
        }

        if (parentServer.vitest.coverageProvider) {
          const coverage = parentServer.vitest._coverageOptions
          const provider = coverage.provider
          if (provider === 'v8') {
            const path = tryResolve('@vitest/coverage-v8', [parentServer.config.root])
            if (path) {
              entries.push(path)
              exclude.push('@vitest/coverage-v8/browser')
            }
          }
          else if (provider === 'istanbul') {
            const path = tryResolve('@vitest/coverage-istanbul', [parentServer.config.root])
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
          'vitest > @vitest/expect > chai',
        ]

        const provider = parentServer.config.browser.provider || [...parentServer.children][0]?.provider
        if (provider?.name === 'preview') {
          include.push(
            '@vitest/browser-preview > @testing-library/user-event',
            '@vitest/browser-preview > @testing-library/dom',
          )
        }

        const fileRoot = browserTestFiles[0] ? dirname(browserTestFiles[0]) : project.config.root

        const svelte = isPackageExists('vitest-browser-svelte', fileRoot)
        if (svelte) {
          exclude.push('vitest-browser-svelte')
        }

        // since we override the resolution in the esbuild plugin, Vite can no longer optimizer it
        const vue = isPackageExists('vitest-browser-vue', fileRoot)
        if (vue) {
          // we override them in the esbuild plugin so optimizer can no longer intercept it
          include.push(
            'vitest-browser-vue',
            'vitest-browser-vue > @vue/test-utils',
            'vitest-browser-vue > @vue/test-utils > @vue/compiler-core',
          )
        }
        const vueTestUtils = isPackageExists('@vue/test-utils', fileRoot)
        if (vueTestUtils) {
          include.push('@vue/test-utils')
        }

        const otelConfig = project.config.experimental.openTelemetry
        if (otelConfig?.enabled && otelConfig.browserSdkPath) {
          entries.push(otelConfig.browserSdkPath)
          include.push('@opentelemetry/api')
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
        if (id.includes(parentServer.vite.config.cacheDir) && id.includes('loupe.js')) {
          // loupe bundle has a nastry require('util') call that leaves a warning in the console
          const utilRequire = 'nodeUtil = require_util();'
          return code.replace(utilRequire, ' '.repeat(utilRequire.length))
        }
      },
    },
    BrowserContext(parentServer),
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

        const defaultPort = parentServer.vitest.state._data.browserLastPort++

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
            parentServer.vitest.config.root,
            parentServer.vitest.vite.config.configFile,
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
      transform: {
        filter: {
          code: /import\.meta\.vitest/,
        },
        handler(code, id) {
          const filename = cleanUrl(id)

          if (!code.includes('import.meta.vitest')) {
            return
          }
          const s = new MagicString(code, { filename })
          s.prepend(
            `Object.defineProperty(import.meta, 'vitest', { get() { return typeof __vitest_worker__ !== 'undefined' && __vitest_worker__.filepath === "${filename.replace(/"/g, '\\"')}" ? __vitest_index__ : undefined } });\n`,
          )
          return {
            code: s.toString(),
            map: s.generateMap({ hires: true }),
          }
        },
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
      name: 'vitest:browser:transform-tester-html',
      enforce: 'pre',
      async transformIndexHtml(html, ctx) {
        const projectBrowser = [...parentServer.children].find((server) => {
          return ctx.filename === server.testerFilepath
        })
        if (!projectBrowser) {
          return
        }

        const stateJs = typeof parentServer.stateJs === 'string'
          ? parentServer.stateJs
          : await parentServer.stateJs

        const testerTags: HtmlTagDescriptor[] = []

        const isDefaultTemplate = resolve(distRoot, 'client/tester/tester.html') === projectBrowser.testerFilepath
        if (!isDefaultTemplate) {
          const manifestContent = parentServer.manifest instanceof Promise
            ? await parentServer.manifest
            : parentServer.manifest
          const testerEntry = manifestContent['tester/tester.html']

          testerTags.push({
            tag: 'script',
            attrs: {
              type: 'module',
              crossorigin: '',
              src: `${parentServer.base}${testerEntry.file}`,
            },
            injectTo: 'head',
          })

          for (const importName of testerEntry.imports || []) {
            const entryManifest = manifestContent[importName]
            if (entryManifest) {
              testerTags.push(
                {
                  tag: 'link',
                  attrs: {
                    href: `${parentServer.base}${entryManifest.file}`,
                    rel: 'modulepreload',
                    crossorigin: '',
                  },
                  injectTo: 'head',
                },
              )
            }
          }
        }
        else {
          // inject the reset style only in the default template,
          // allowing users to customize the style in their own template
          testerTags.push({
            tag: 'style',
            children: `
html {
  padding: 0;
  margin: 0;
}
body {
  padding: 0;
  margin: 0;
  min-height: 100vh;
}`,
            injectTo: 'head',
          })
        }

        return [
          {
            tag: 'script',
            children: '{__VITEST_INJECTOR__}',
            injectTo: 'head-prepend' as const,
          },
          {
            tag: 'script',
            children: stateJs,
            injectTo: 'head-prepend',
          } as const,
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: parentServer.errorCatcherUrl,
            },
            injectTo: 'head' as const,
          },
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: parentServer.matchersUrl,
            },
            injectTo: 'head' as const,
          },
          ...parentServer.initScripts.map(script => ({
            tag: 'script',
            attrs: {
              type: 'module',
              src: join('/@fs/', script),
            },
            injectTo: 'head',
          } as const)),
          ...testerTags,
        ].filter(s => s != null)
      },
    },
    {
      name: 'vitest:browser:support-testing-library',
      enforce: 'pre',
      config() {
        const rolldownPlugin = {
          name: 'vue-test-utils-rewrite',
          resolveId: {
            // test-utils: resolve to CJS instead of the browser because the browser version expects a global Vue object
            // compiler-core: only CJS version allows slots as strings
            filter: { id: /^@vue\/(test-utils|compiler-core)$/ },
            handler(source: string, importer: string) {
              const resolved = getRequire().resolve(source, {
                paths: [importer!],
              })
              return resolved
            },
          },
        }
        const esbuildPlugin = {
          name: 'test-utils-rewrite',
          // "any" because vite doesn't expose any types for this
          setup(build: any) {
            // test-utils: resolve to CJS instead of the browser because the browser version expects a global Vue object
            // compiler-core: only CJS version allows slots as strings
            build.onResolve({ filter: /^@vue\/(test-utils|compiler-core)$/ }, (args: any) => {
              const resolved = getRequire().resolve(args.path, {
                paths: [args.importer],
              })
              return { path: resolved }
            })
          },
        }

        return {
          optimizeDeps: rolldownVersion
            ? { rolldownOptions: { plugins: [rolldownPlugin] } }
            : { esbuildOptions: { plugins: [esbuildPlugin] } },
        }
      },
    },
    {
      name: 'vitest:browser:__vitest_browser_import_meta_env_init__',
      transform: {
        handler(code) {
          // this transform runs after `vitest:meta-env-replacer` so that
          // `import.meta.env` will be handled by Vite import analysis to match behavior.
          if (code.includes('__vitest_browser_import_meta_env_init__')) {
            return code.replace('__vitest_browser_import_meta_env_init__', 'import.meta.env')
          }
        },
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

const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
