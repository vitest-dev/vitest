import type { HtmlTagDescriptor, UserConfig, UserConfig as ViteUserConfig } from 'vite'
import type { BrowserCommand, BrowserProviderOption, BrowserServerContribution, BrowserServerFactory, PluginHarness, ResolvedConfig } from 'vitest/node'
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { MockerRegistry } from '@vitest/mocker'
import { interceptorPlugin } from '@vitest/mocker/node'
import { distClientRoot as uiClientRoot } from '@vitest/ui'
import { cleanUrl, toArray } from '@vitest/utils/helpers'
import { join, resolve } from 'pathe'
import sirv from 'sirv'
import c from 'tinyrainbow'
import { isCSSRequest, isFileServingAllowed, isValidApiRequest, rolldownVersion, distDir as vitestDist } from 'vitest/node'
import { version } from '../../package.json'
import { distRoot } from './constants'
import { createOrchestratorMiddleware } from './middlewares/orchestratorMiddleware'
import { createTesterMiddleware } from './middlewares/testerMiddleware'
import BrowserPlugin from './plugin'
import { ParentBrowserProject } from './projectParent'
import { setupBrowserRpc } from './rpc'

export type { CustomComparatorsRegistry } from './commands/screenshotMatcher/types'

export interface SerializedLocator {
  selector: string
  locator: string
}

export function defineBrowserCommand<T extends unknown[]>(
  fn: BrowserCommand<T>,
): BrowserCommand<T> {
  return fn
}

// export type { ProjectBrowser } from './project'
export { assertBrowserApiWrite, assertBrowserFileAccess, parseKeyDef, resolveScreenshotPath } from './utils'

const versionRegexp = /(?:\?|&)v=\w{8}/

/**
 * The browser provider's `serverFactory`. Returns a `BrowserServerContribution`
 * that Vitest core uses to build the SINGLE Vite server shared by `project.vite`
 * and `project.browser.vite`. This factory does NOT create a server (core does);
 * it only contributes config, plugins, the parent factory, and the RPC setup.
 */
export const createBrowserServer: BrowserServerFactory = async () => {
  const mockerRegistry = new MockerRegistry()

  const contribution: BrowserServerContribution = {
    async transformIndexHtml(ctx) {
      const parentServer = contribution.parent as ParentBrowserProject
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
    configureServer(server) {
      const parentServer = contribution.parent as ParentBrowserProject
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
      // strip _vitest_original query added by importActual so that
      // the plugin pipeline sees the original import id (e.g. virtual modules's load hook).
      server.middlewares.use((req, _res, next) => {
        if (
          req.url?.includes('_vitest_original')
          && parentServer.config.browser.provider?.name === 'playwright'
        ) {
          req.url = req.url
            .replace(/[?&]_vitest_original(?=[&#]|$)/, '')
            .replace(/[?&]ext\b[^&#]*/, '')
            .replace(/\?$/, '')
        }
        next()
      })
      server.middlewares.use(createOrchestratorMiddleware(parentServer))
      server.middlewares.use(createTesterMiddleware(parentServer))

      server.middlewares.use(
        `/favicon.svg`,
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

      // When the Vitest UI (`test.ui`) is enabled, the `vitest:ui` plugin owns
      // `/__vitest__` (including the token-injected index.html and its assets),
      // so registering sirv here would shadow it and serve the page without a token.
      if (!parentServer.vitest.config.ui) {
        server.middlewares.use(
          '/__vitest__',
          sirv(uiClientRoot),
        )
      }
    },
    // Resolution-time config: only what is derivable from the (partial) user
    // config. The mocks / coverage / meta-env plugins come from the shared
    // workspace plugin set, not from here.
    async config(viteConfig) {
      const testConfig = viteConfig.test || {}
      const config: UserConfig = {
        resolve: {
          alias: testConfig.alias,
          dedupe: ['vitest'],
        },
        server: {
          fs: {
            allow: [distRoot],
          },
          middlewareMode: false,
          watch: null,
          // Vitest forwards browser console logs and unhandled errors through its
          // own RPC, so Vite's client forwarding (defaults on under agents) would
          // double-report them and leak into stderr.
          forwardConsole: false,
        },
      }
      // Enables using the @preserve ignore hint for coverage providers. Only for
      // esbuild (rolldown-vite uses oxc instead).
      if (!rolldownVersion && viteConfig.esbuild !== false) {
        config.esbuild = { legalComments: 'inline' }
      }
      const define: Record<string, string> = {}
      const envVars = testConfig.env || {}
      for (const env in envVars) {
        define[`import.meta.env.${env}`] = JSON.stringify(envVars[env])
      }
      config.define = define
      return config
    },
    resolveOptimizeDeps(projectConfigs, testFiles, harness) {
      return resolveBrowserOptimizeDeps(projectConfigs, testFiles, harness)
    },
    plugins: [],
    createParent({ config, vitest }) {
      if (vitest.version !== version) {
        vitest.logger.warn(
          c.yellow(
            `Loaded ${c.inverse(c.yellow(` vitest@${vitest.version} `))} and ${c.inverse(c.yellow(` @vitest/browser@${version} `))}.`
            + '\nRunning mixed versions is not supported and may lead into bugs'
            + '\nUpdate your dependencies and make sure the versions match.',
          ),
        )
      }
      return new ParentBrowserProject({ config, vitest }, '/')
    },
    setupRpc(parent) {
      setupBrowserRpc(parent as ParentBrowserProject, mockerRegistry)
    },
  }

  contribution.plugins = [
    ...BrowserPlugin(contribution),
    // this plugin's `configureServer` is ignored since it's added through `applyToEnvironment`
    interceptorPlugin({ registry: mockerRegistry }),
    {
      name: 'vitest:browser:framework-sourcemaps',
      enforce: 'post',
      transform(code, id) {
        const parentServer = contribution.parent as ParentBrowserProject | undefined
        // In a headless run nothing can open devtools, so sourcemaps of
        // Vitest's own pre-built modules are never consumed: their stack
        // frames are filtered by stackIgnorePatterns. Generating and
        // inlining these maps costs server CPU and multiplies the bytes
        // the browser downloads by ~5 for every fresh browser context.
        // Sourcemaps of user files and (by default) their dependencies are
        // kept — they point error stacks and devtools at original sources.
        if (
          !parentServer
          || !isHeadlessServer(parentServer)
          || parentServer.vitest.config.inspector.enabled
        ) {
          return null
        }
        if (isCSSRequest(id)) {
          return null
        }
        const path = cleanUrl(id)
        if (path.startsWith(distRoot) || path.startsWith(vitestDist)) {
          return { code, map: { mappings: '' } as any }
        }
        // users that never debug into node_modules can drop dependency
        // sourcemaps entirely; `server.sourcemapIgnoreList` (default:
        // node_modules) can opt paths back in even then, e.g. with
        // `preserveSymlinks` where workspace code keeps its node_modules
        // path and would be wrongly treated as a dependency
        if (
          parentServer.config.browser.dependencySourcemaps === false
          && path.includes('/node_modules/')
          && (parentServer.vite.config.server.sourcemapIgnoreList(path, path) ?? true)
        ) {
          return { code, map: { mappings: '' } as any }
        }
        return null
      },
    },
  ]

  return contribution
}

function isHeadlessServer(parentServer: ParentBrowserProject): boolean {
  if (!parentServer.config.browser.headless) {
    return false
  }
  // sibling instances share this server (and its module graph cache, so a
  // late-spawned instance would receive already-cached transforms) and can
  // override `headless` — check the static instance options instead of the
  // lazily populated `children` to stay deterministic across runs
  const instances = parentServer.config.browser.instances ?? []
  return instances.every(instance => instance.headless !== false)
}

function resolveBrowserOptimizeDeps(
  projectConfigs: ResolvedConfig[],
  testFiles: string[],
  harness: PluginHarness,
): NonNullable<ViteUserConfig['optimizeDeps']> {
  // `testFiles` are globbed by the core package and aggregated across every
  // project that shares this browser Vite server (instance and benchmark
  // variants). The remaining options are shared by those projects, so the first
  // config is representative.
  const testConfig = projectConfigs[0]
  const root = testConfig.root || process.cwd()

  const setupFiles = new Set(
    projectConfigs.flatMap(config => toArray(config.setupFiles || [])),
  )

  const entries: string[] = [
    ...testFiles,
    ...setupFiles,
    resolve(vitestDist, 'index.js'),
    resolve(vitestDist, 'browser.js'),
    resolve(vitestDist, 'runners.js'),
    resolve(vitestDist, 'utils.js'),
    ...(testConfig.snapshotSerializers || []),
  ]

  // Keep these external (never pre-bundle by optimizer):
  // - vitest/browser, @vitest/browser/context, @vitest/browser/utils are
  //   VIRTUAL modules generated per-server (see pluginContext.ts) — optimizer
  //   cannot resolve/run their `load`, it would freeze stale/empty content.
  // - vite/module-runner is small enough to not need pre-bundling.
  // - msw is a large, side-effectful service-worker library.
  const exclude = [
    'vitest/browser',
    'vite/module-runner',
    '@vitest/browser/utils',
    '@vitest/browser/context',
    'msw',
    'msw/browser',
  ]

  if (typeof testConfig.diff === 'string') {
    entries.push(testConfig.diff)
  }

  if (testConfig.coverage?.enabled) {
    const provider = testConfig.coverage.provider ?? 'v8'
    if (provider === 'v8') {
      const path = tryResolve('@vitest/coverage-v8', [root])
      if (path) {
        entries.push(path)
        exclude.push('@vitest/coverage-v8/browser')
      }
    }
    else if (provider === 'istanbul') {
      const path = tryResolve('@vitest/coverage-istanbul', [root])
      if (path) {
        entries.push(path)
        exclude.push('@vitest/coverage-istanbul')
      }
    }
    else if (provider === 'custom' && testConfig.coverage.customProviderModule) {
      entries.push(testConfig.coverage.customProviderModule)
    }
  }

  // Pre-bundle the vitest runtime so the browser fetches a few optimized
  // chunks instead of ~20 separately-served dist chunks (faster startup).
  // `vitest`, `vitest/internal/browser` and `@vitest/browser/client` are
  // optimized together in a single pass, so esbuild dedupes their shared
  // stateful chunks (the test collector, the runner, the RPC client) to a
  // single instance — preserving module identity between the test files'
  // `import 'vitest'` and the tester. Their transitive deps (@vitest/utils,
  // @vitest/spy, pathe, tinyrainbow, …) are inlined into these bundles.
  const include = [
    'vitest > expect-type',
    'vitest > magic-string',
    'vitest > chai',
    'vitest',
    'vitest/internal/browser',
    '@vitest/browser/client',
  ]

  const provider = testConfig.browser?.provider
  if (provider?.name === 'preview') {
    include.push(
      '@vitest/browser-preview > @testing-library/user-event',
      '@vitest/browser-preview > @testing-library/dom',
    )
  }

  const isPackageExists = (pkg: string) => {
    return harness.packageInstaller.isPackageExists(pkg, { paths: [root] })
  }

  if (isPackageExists('vitest-browser-svelte')) {
    exclude.push('vitest-browser-svelte')
  }
  // since we override the resolution in the esbuild plugin, Vite can no longer optimize it
  if (isPackageExists('vitest-browser-vue')) {
    include.push(
      'vitest-browser-vue',
      'vitest-browser-vue > @vue/test-utils',
      'vitest-browser-vue > @vue/test-utils > @vue/compiler-core',
    )
  }
  if (isPackageExists('@vue/test-utils')) {
    include.push('@vue/test-utils')
  }

  const otelConfig = testConfig.experimental?.openTelemetry
  if (otelConfig?.enabled && otelConfig.browserSdkPath) {
    entries.push(otelConfig.browserSdkPath)
    include.push('@opentelemetry/api')
  }
  else {
    exclude.push('@opentelemetry/api')
  }

  // resolve @vue/(test-utils|compiler-core) to CJS instead of the browser build:
  // test-utils' browser build expects a global Vue; compiler-core's CJS build is
  // the only one that allows slots as strings.
  const rolldownPlugin = {
    name: 'vue-test-utils-rewrite',
    resolveId: {
      filter: { id: /^@vue\/(test-utils|compiler-core)$/ },
      handler(source: string, importer: string) {
        return getRequire().resolve(source, { paths: [importer!] })
      },
    },
  }
  const esbuildPlugin = {
    name: 'test-utils-rewrite',
    setup(build: any) {
      build.onResolve({ filter: /^@vue\/(test-utils|compiler-core)$/ }, (args: any) => {
        return { path: getRequire().resolve(args.path, { paths: [args.importer] }) }
      })
    },
  }

  return {
    entries,
    exclude,
    include,
    ...(rolldownVersion
      ? { rolldownOptions: { plugins: [rolldownPlugin] } }
      : { esbuildOptions: { plugins: [esbuildPlugin] } }),
  }
}

function tryResolve(path: string, paths: string[]) {
  try {
    return getRequire().resolve(path, { paths })
  }
  catch {
    return undefined
  }
}

let _require: ReturnType<typeof createRequire>
function getRequire(): ReturnType<typeof createRequire> {
  if (!_require) {
    _require = createRequire(import.meta.url)
  }
  return _require
}

export function defineBrowserProvider<T extends object = object>(options: Omit<
  BrowserProviderOption<T>,
  'serverFactory' | 'options'
> & { options?: T }): BrowserProviderOption {
  return {
    ...options,
    options: options.options || {},
    serverFactory: createBrowserServer,
  }
}
