import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { CliOptions } from '../cli/cli-api'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig, UserConfig } from '../types/config'
import { deepMerge } from '@vitest/utils/helpers'
import { relative, resolve } from 'pathe'
import * as vite from 'vite'
import { defaultPort } from '../../constants'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { resolveApiServerConfig } from '../config/resolveConfig'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestOptimizer } from './optimizer'
import { ModuleRunnerTransform } from './runnerTransform'
import {
  deleteDefineConfig,
  getDefaultResolveOptions,
  resolveFsAllow,
} from './utils'
import { VitestCoreResolver } from './vitestResolver'

// the plugins required when starting Vitest
export function VitestCorePlugin(
  harness: PluginHarness,
): VitePlugin[] {
  return [
    ...CSSEnablerPlugin({
      get config() {
        return harness.getVitest().config
      },
    }),
    ...MocksPlugins(),
    CoverageTransform(() => harness.getVitest()),
    VitestCoreResolver(),
    NormalizeURLPlugin(),
    MetaEnvReplacerPlugin(),
    {
      name: 'vitest:ui-injector',
      enforce: 'post',
      async configResolved(config) {
        if (config.test.ui) {
          await harness.packageInstaller.ensureInstalled('@vitest/ui', resolve(config.root), harness.version)
          const uiPlugin = (await import('@vitest/ui')).default(
            harness.logger,
            harness.version,
          )
          // @ts-expect-error mutate readonly
          config.plugins.push(uiPlugin)
        }
      },
    },
    // TODO: separetly
    // {
    //   name: 'vitest:module-runner-fixer',
    //   configureServer: {
    //     // Install a `ServerModuleRunner` override on the SSR environment so
    //     // that user plugins' `configureServer` hooks can call
    //     // `server.environments.ssr.runner.import(...)` and get Vitest's
    //     // module runner (which respects `noExternal` etc.) instead of Vite's
    //     // default `ESModulesEvaluator` (which does not support CJS deps).
    //     //
    //     // Runs `enforce: 'pre'` so it sits before user plugins in the chain.
    //     order: 'pre',
    //     async handler(server) {
    //       const ssrEnvironment = server.environments.ssr
    //       if (vite.isRunnableDevEnvironment(ssrEnvironment)) {
    //         const ssrRunner = new ServerModuleRunner(
    //           ssrEnvironment,
    //           vitest._fetcher,
    //           vitest.config,
    //         )
    //         Object.defineProperty(ssrEnvironment, 'runner', {
    //           value: ssrRunner,
    //           writable: true,
    //           configurable: true,
    //         })
    //       }
    //     },
    //   },
    // },
  ]
}

// the plugins required when resolving the config
export function VitestConfigPlugin(options: CliOptions = {}): VitePlugin[] {
  const userConfig = deepMerge({}, options) as CliOptions

  let resolvedRoot: string

  return [
    <VitePlugin>{
      name: 'vitest',
      enforce: 'pre',
      options() {
        this.meta.watchMode = false
      },
      async config(viteConfig) {
        if (options.watch) {
          // Earlier runs have overwritten values of the `options`.
          // Reset it back to initial user config before setting up the server again.
          options = deepMerge({}, userConfig) as UserConfig
        }

        // preliminary merge of options to be able to create server options for vite
        // however to allow vitest plugins to modify vitest config values
        // this is repeated in configResolved where the config is final
        const testConfig = deepMerge(
          {} as UserConfig,
          configDefaults,
          viteConfig.test ?? {},
          options,
        )
        testConfig.api = resolveApiServerConfig(testConfig, defaultPort)

        // store defines for globalThis to make them
        // reassignable when running in worker in src/runtime/setup.ts
        const originalDefine = { ...viteConfig.define } // stash original defines for browser mode
        const defines: Record<string, any> = deleteDefineConfig(viteConfig)

        ;(options as unknown as ResolvedConfig).defines = defines
        ;(options as unknown as ResolvedConfig).viteDefine = originalDefine

        let open: string | boolean | undefined = false

        if (testConfig.ui && testConfig.open) {
          open = testConfig.uiBase ?? '/__vitest__/'
        }

        const resolveOptions = getDefaultResolveOptions()

        let config: ViteConfig = {
          base: '/',
          root: viteConfig.test?.root || options.root,
          define: {
            // disable replacing `process.env.NODE_ENV` with static string by vite:client-inject
            'process.env.NODE_ENV': 'process.env.NODE_ENV',
          },
          resolve: {
            ...resolveOptions,
            alias: testConfig.alias,
          },
          server: {
            ...testConfig.api,
            open,
            hmr: false,
            ws: testConfig.api?.middlewareMode ? false : undefined,
            preTransformRequests: false,
            fs: {
              allow: resolveFsAllow(options.root || process.cwd(), testConfig.config),
            },
          },
          build: {
            // Vitest doesn't use outputDir, but this value affects what folders are watched
            // https://github.com/vitejs/vite/pull/16453
            emptyOutDir: false,
          },
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore Vite 6 compat
          environments: {
            ssr: {
              resolve: resolveOptions,
            },
            __vitest__: {
              dev: {},
            },
          },
          test: {
            root: testConfig.root ?? viteConfig.test?.root,
            deps: testConfig.deps ?? viteConfig.test?.deps,
          },
        }

        if ('rolldownVersion' in vite) {
          config = {
            ...config,
            // eslint-disable-next-line ts/ban-ts-comment
            // @ts-ignore rolldown-vite only
            oxc: viteConfig.oxc === false
              ? false
              : {
                  // eslint-disable-next-line ts/ban-ts-comment
                  // @ts-ignore rolldown-vite only
                  target: viteConfig.oxc?.target || 'node18',
                },
          }
        }
        else {
          config = {
            ...config,
            esbuild: viteConfig.esbuild === false
              ? false
              : {
                  // Lowest target Vitest supports is Node18
                  target: viteConfig.esbuild?.target || 'node18',
                  sourcemap: 'external',
                  // Enables using ignore hint for coverage providers with @preserve keyword
                  legalComments: 'inline',
                },
          }
        }

        if (options.benchmarkOnly) {
          config.test!.benchmark ??= {}
          config.test!.benchmark.enabled = true
        }

        // inherit so it's available in VitestOptimizer
        // I cannot wait to rewrite all of this in Vitest 4
        if (options.cache != null) {
          config.test!.cache = options.cache
        }

        // if (vitest.configOverride.project) {
        //   // project filter was set by the user, so we need to filter the project
        //   options.project = vitest.configOverride.project
        // }

        // TODO!
        // config.customLogger = createViteLogger(
        //   vitest.logger,
        //   viteConfig.logLevel || 'warn',
        //   {
        //     allowClearScreen: false,
        //   },
        // )
        // config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

        // chokidar fsevents is unstable on macos when emitting "ready" event
        if (
          process.platform === 'darwin'
          && process.env.VITE_TEST_WATCHER_DEBUG
        ) {
          const watch = config.server!.watch
          if (watch) {
            // eslint-disable-next-line ts/ban-ts-comment
            // @ts-ignore Vite 6 compat
            watch.useFsEvents = false
            watch.usePolling = false
          }
        }

        const classNameStrategy
          = (typeof testConfig.css !== 'boolean'
            && testConfig.css?.modules?.classNameStrategy)
          || 'stable'

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          if (config.css.modules) {
            config.css.modules.generateScopedName = (
              name: string,
              filename: string,
            ) => {
              return generateScopedClassName(
                classNameStrategy,
                name,
                relative(resolvedRoot, filename),
              )!
            }
          }
        }

        return config
      },
      async configResolved(viteConfig) {
        resolvedRoot = viteConfig.root

        const viteConfigTest = (viteConfig.test as UserConfig) || {}
        if (viteConfigTest.watch === false) {
          ;(viteConfigTest as any).run = true
        }

        if ('alias' in viteConfigTest) {
          delete viteConfigTest.alias
        }

        // Merge defaults + Vite's resolved test config + the CLI options into
        // a single object and assign it back onto `viteConfig.test`. Downstream
        // Vitest reads this resolved test config directly (no `_vitest` stash
        // needed now that the server can be created from a resolved config).
        const merged: UserConfig = deepMerge({}, configDefaults, viteConfigTest, options)
        merged.api = resolveApiServerConfig(merged, defaultPort)

        // Auto-name browser instances based on the project name + browser kind.
        if (merged.browser?.instances) {
          const baseName = merged.name
          merged.browser.instances.forEach((instance) => {
            instance.name ??= baseName ? `${baseName} (${instance.browser})` : instance.browser
          })
        }

        // we replace every "import.meta.env" with "process.env"
        // to allow reassigning, so we need to put all envs on process.env
        const { PROD, DEV, ...envs } = viteConfig.env

        // process.env can have only string values and will cast string on it if we pass other type,
        // so we are making them truthy
        process.env.PROD ??= PROD ? '1' : ''
        process.env.DEV ??= DEV ? '1' : ''

        for (const name in envs) {
          process.env[name] ??= envs[name]
        }

        // don't watch files in run mode
        if (!merged.watch) {
          viteConfig.server.watch = null
        }

        // TODO: call internal resolveConfig here and assign the value
        ;(viteConfig as any).test = merged
      },
    },
    VitestOptimizer(),
    ModuleRunnerTransform(),
  ]
}
