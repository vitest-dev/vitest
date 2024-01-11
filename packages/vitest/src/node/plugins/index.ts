import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { relative } from 'pathe'
import { configDefaults } from '../../defaults'
import type { ResolvedConfig, UserConfig } from '../../types'
import { deepMerge, notNullish, removeUndefinedValues } from '../../utils'
import { ensurePackageInstalled } from '../pkg'
import { resolveApiServerConfig } from '../config'
import { Vitest } from '../core'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { SsrReplacerPlugin } from './ssrReplacer'
import { CSSEnablerPlugin } from './cssEnabler'
import { CoverageTransform } from './coverageTransform'
import { MocksPlugin } from './mocks'
import { deleteDefineConfig, hijackVitePluginInject, resolveFsAllow } from './utils'
import { VitestResolver } from './vitestResolver'
import { VitestOptimizer } from './optimizer'
import { NormalizeURLPlugin } from './normalizeURL'

export async function VitestPlugin(options: UserConfig = {}, ctx = new Vitest('test')): Promise<VitePlugin[]> {
  const userConfig = deepMerge({}, options) as UserConfig

  const getRoot = () => ctx.config?.root || options.root || process.cwd()

  async function UIPlugin() {
    await ensurePackageInstalled('@vitest/ui', getRoot())
    return (await import('@vitest/ui')).default(ctx)
  }

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
          options,
          removeUndefinedValues(viteConfig.test ?? {}),
        )
        testConfig.api = resolveApiServerConfig(testConfig)

        testConfig.poolOptions ??= {}
        testConfig.poolOptions.threads ??= {}
        testConfig.poolOptions.forks ??= {}
        // prefer --poolOptions.{name}.isolate CLI arguments over --isolate, but still respect config value
        testConfig.poolOptions.threads.isolate = options.poolOptions?.threads?.isolate ?? options.isolate ?? testConfig.poolOptions.threads.isolate ?? viteConfig.test?.isolate
        testConfig.poolOptions.forks.isolate = options.poolOptions?.forks?.isolate ?? options.isolate ?? testConfig.poolOptions.forks.isolate ?? viteConfig.test?.isolate

        // store defines for globalThis to make them
        // reassignable when running in worker in src/runtime/setup.ts
        const defines: Record<string, any> = deleteDefineConfig(viteConfig)

        ;(options as ResolvedConfig).defines = defines

        let open: string | boolean | undefined = false

        if (testConfig.ui && testConfig.open)
          open = testConfig.uiBase ?? '/__vitest__/'

        const config: ViteConfig = {
          root: viteConfig.test?.root || options.root,
          esbuild: viteConfig.esbuild === false
            ? false
            : {
                sourcemap: 'external',

                // Enables using ignore hint for coverage providers with @preserve keyword
                legalComments: 'inline',
              },
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: testConfig.alias,
            conditions: ['node'],
          },
          server: {
            ...testConfig.api,
            watch: {
              ignored: testConfig.watchExclude,
            },
            open,
            hmr: false,
            preTransformRequests: false,
            fs: {
              allow: resolveFsAllow(getRoot(), testConfig.config),
            },
          },
          test: {
            poolOptions: testConfig.poolOptions,
          },
        }

        // chokidar fsevents is unstable on macos when emitting "ready" event
        if (process.platform === 'darwin' && process.env.VITE_TEST_WATCHER_DEBUG) {
          config.server!.watch!.useFsEvents = false
          config.server!.watch!.usePolling = false
        }

        const classNameStrategy = (typeof testConfig.css !== 'boolean' && testConfig.css?.modules?.classNameStrategy) || 'stable'

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          if (config.css.modules) {
            config.css.modules.generateScopedName = (name: string, filename: string) => {
              const root = getRoot()
              return generateScopedClassName(classNameStrategy, name, relative(root, filename))!
            }
          }
        }

        return config
      },
      async configResolved(viteConfig) {
        const viteConfigTest = (viteConfig.test as any) || {}
        if (viteConfigTest.watch === false)
          viteConfigTest.run = true

        if ('alias' in viteConfigTest)
          delete viteConfigTest.alias

        // viteConfig.test is final now, merge it for real
        options = deepMerge(
          {},
          configDefaults,
          viteConfigTest,
          options,
        )
        options.api = resolveApiServerConfig(options)

        // we replace every "import.meta.env" with "process.env"
        // to allow reassigning, so we need to put all envs on process.env
        const { PROD, DEV, ...envs } = viteConfig.env

        // process.env can have only string values and will cast string on it if we pass other type,
        // so we are making them truthy
        process.env.PROD ??= PROD ? '1' : ''
        process.env.DEV ??= DEV ? '1' : ''

        for (const name in envs)
          process.env[name] ??= envs[name]

        // don't watch files in run mode
        if (!options.watch)
          viteConfig.server.watch = null

        hijackVitePluginInject(viteConfig)
      },
      async configureServer(server) {
        if (options.watch && process.env.VITE_TEST_WATCHER_DEBUG) {
          server.watcher.on('ready', () => {
            // eslint-disable-next-line no-console
            console.log('[debug] watcher is ready')
          })
        }
        try {
          await ctx.setServer(options, server, userConfig)
          if (options.api && options.watch)
            (await import('../../api/setup')).setup(ctx)
        }
        catch (err) {
          await ctx.logger.printError(err, { fullStack: true })
          process.exit(1)
        }

        // #415, in run mode we don't need the watcher, close it would improve the performance
        if (!options.watch)
          await server.watcher.close()
      },
    },
    SsrReplacerPlugin(),
    ...CSSEnablerPlugin(ctx),
    CoverageTransform(ctx),
    options.ui
      ? await UIPlugin()
      : null,
    MocksPlugin(),
    VitestResolver(ctx),
    VitestOptimizer(),
    NormalizeURLPlugin(),
  ]
    .filter(notNullish)
}
