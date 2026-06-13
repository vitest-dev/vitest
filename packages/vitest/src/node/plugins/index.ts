import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { CliOptions } from '../cli/cli-api'
import type { PluginHarness } from '../config/pluginHarness'
import type { UserConfig } from '../types/config'
import { deepMerge } from '@vitest/utils/helpers'
import { resolve } from 'pathe'
import { defaultPort } from '../../constants'
import { configDefaults } from '../../defaults'
import { resolveApiServerConfig } from '../config/resolveConfig'
import { VitestConfig } from './config'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { resolveFsAllow } from './utils'
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
    CoverageTransform(harness),
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
export function VitestConfigPlugin(harness: PluginHarness, options: CliOptions = {}): VitePlugin[] {
  const userConfig = deepMerge({}, options) as CliOptions

  return [
    // The CLI plugin overwrites config values with CLI options, making them
    // avalable in the next plugin. We have to do this via plugins because of watch mode.
    {
      name: 'vitest:config:cli',
      enforce: 'pre',
      config: {
        order: 'pre',
        handler() {
          if (options.watch) {
            // Earlier runs have overwritten values of the `options`.
            // Reset it back to initial user config before setting up the server again.
            options = deepMerge({}, userConfig) as UserConfig
          }

          return {
            // Vite will automatically merge CLI options
            test: options,
          }
        },
      },
    },
    // Setting Vite config values based on user settings,
    // The resolved config value is determined in `configResolved:post`
    // This is simmilar to `vitest:config` plugin, but the options here are affected by CLI
    {
      name: 'vitest:config:append',
      enforce: 'post',
      options() {
        this.meta.watchMode = false
      },
      config: {
        order: 'post',
        handler(viteConfig) {
          // Custom user config, this includes CLI overrides
          const testConfig = viteConfig.test ?? {}

          const api = resolveApiServerConfig(
            testConfig,
            defaultPort,
            undefined,
            harness.logger,
          )
          testConfig.api = api

          let open: string | boolean | undefined = false

          if (testConfig.ui && testConfig.open) {
            open = testConfig.uiBase ?? '/__vitest__/'
          }

          const root = resolve(options.root || process.cwd())

          const config: ViteConfig = {
            base: '/',
            root,
            server: {
              ...api,
              open,
              hmr: false,
              ws: api?.middlewareMode ? false : undefined,
              preTransformRequests: false,
              watch: testConfig.watch ? {} : null,
              fs: {
                allow: resolveFsAllow(root, options.config),
              },
            },
            build: {
              // Vitest doesn't use outputDir, but this value affects what folders are watched
              // https://github.com/vitejs/vite/pull/16453
              emptyOutDir: false,
            },
          }

          if (options.benchmarkOnly) {
            testConfig.benchmark ??= {}
            testConfig.benchmark.enabled = true
          }

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

          return config
        },
      },
    },
    ...VitestConfig(harness),
    // Final config resolution. Making sure that CLI options always have precedent
    // even if the value was changed by a user plugin.
    {
      name: 'vitest:config:resolve',
      enforce: 'post',
      configResolved: {
        order: 'post',
        handler(viteConfig) {
          const testConfig = (viteConfig.test ?? {}) as UserConfig

          if ('alias' in testConfig) {
            delete testConfig.alias
          }

          const resolvedConfig: UserConfig = deepMerge(
            {},
            configDefaults,
            testConfig,
          )

          // Auto-name browser instances based on the project name + browser kind.
          if (resolvedConfig.browser?.instances) {
            const baseName = resolvedConfig.name
            resolvedConfig.browser.instances.forEach((instance) => {
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
          if (!resolvedConfig.watch) {
            viteConfig.server.watch = null
          }

          ;(viteConfig as any).test = resolvedConfig
        },
      },
    },
  ]
}
