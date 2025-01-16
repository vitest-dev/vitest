import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { ResolvedConfig, UserConfig } from '../types/config'
import {
  deepMerge,
  notNullish,
  toArray,
} from '@vitest/utils'
import { relative } from 'pathe'
import { defaultPort } from '../../constants'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { resolveApiServerConfig } from '../config/resolveConfig'
import { Vitest } from '../core'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
import { getDefaultServerConditions } from './conditions'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestOptimizer } from './optimizer'
import { SsrReplacerPlugin } from './ssrReplacer'
import {
  deleteDefineConfig,
  hijackVitePluginInject,
  resolveFsAllow,
} from './utils'
import { VitestCoreResolver } from './vitestResolver'

export async function VitestPlugin(
  options: UserConfig = {},
  ctx = new Vitest('test'),
): Promise<VitePlugin[]> {
  const userConfig = deepMerge({}, options) as UserConfig

  async function UIPlugin() {
    await ctx.packageInstaller.ensureInstalled('@vitest/ui', options.root || process.cwd(), ctx.version)
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
          removeUndefinedValues(viteConfig.test ?? {}),
          options,
        )
        testConfig.api = resolveApiServerConfig(testConfig, defaultPort)

        // store defines for globalThis to make them
        // reassignable when running in worker in src/runtime/setup.ts
        const defines: Record<string, any> = deleteDefineConfig(viteConfig);

        (options as ResolvedConfig).defines = defines

        let open: string | boolean | undefined = false

        if (testConfig.ui && testConfig.open) {
          open = testConfig.uiBase ?? '/__vitest__/'
        }

        const conditions = getDefaultServerConditions()

        const config: ViteConfig = {
          root: viteConfig.test?.root || options.root,
          esbuild:
            viteConfig.esbuild === false
              ? false
              : {
                  // Lowest target Vitest supports is Node18
                  target: viteConfig.esbuild?.target || 'node18',
                  sourcemap: 'external',
                  // Enables using ignore hint for coverage providers with @preserve keyword
                  legalComments: 'inline',
                },
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: testConfig.alias,
            conditions,
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
            // https://github.com/vitest-dev/vitest/issues/5429
            // This works for Vite <5.2.10
            outDir: 'dummy-non-existing-folder',
            // This works for Vite >=5.2.10
            // https://github.com/vitejs/vite/pull/16453
            emptyOutDir: false,
          },
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore Vite 6 compat
          environments: {
            ssr: {
              resolve: {
                // by default Vite resolves `module` field, which not always a native ESM module
                // setting this option can bypass that and fallback to cjs version
                mainFields: [],
                conditions,
              },
            },
          },
          test: {
            poolOptions: {
              threads: {
                isolate:
                  options.poolOptions?.threads?.isolate
                  ?? options.isolate
                  ?? testConfig.poolOptions?.threads?.isolate
                  ?? viteConfig.test?.isolate,
              },
              forks: {
                isolate:
                  options.poolOptions?.forks?.isolate
                  ?? options.isolate
                  ?? testConfig.poolOptions?.forks?.isolate
                  ?? viteConfig.test?.isolate,
              },
            },
            root: testConfig.root ?? viteConfig.test?.root,
            deps: testConfig.deps ?? viteConfig.test?.deps,
          },
        }

        config.customLogger = createViteLogger(
          ctx.logger,
          viteConfig.logLevel || 'warn',
          {
            allowClearScreen: false,
          },
        )
        config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

        // we want inline dependencies to be resolved by analyser plugin so module graph is populated correctly
        if (viteConfig.ssr?.noExternal !== true) {
          const inline = testConfig.server?.deps?.inline
          if (inline === true) {
            config.ssr = { noExternal: true }
          }
          else {
            const noExternal = viteConfig.ssr?.noExternal
            const noExternalArray
              = typeof noExternal !== 'undefined'
                ? toArray(noExternal)
                : undefined
            // filter the same packages
            const uniqueInline
              = inline && noExternalArray
                ? inline.filter(dep => !noExternalArray.includes(dep))
                : inline
            config.ssr = {
              noExternal: uniqueInline,
            }
          }
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
              const root = ctx.config.root || options.root || process.cwd()
              return generateScopedClassName(
                classNameStrategy,
                name,
                relative(root, filename),
              )!
            }
          }
        }

        return config
      },
      async configResolved(viteConfig) {
        const viteConfigTest = (viteConfig.test as any) || {}
        if (viteConfigTest.watch === false) {
          viteConfigTest.run = true
        }

        if ('alias' in viteConfigTest) {
          delete viteConfigTest.alias
        }

        // viteConfig.test is final now, merge it for real
        options = deepMerge({}, configDefaults, viteConfigTest, options)
        options.api = resolveApiServerConfig(options, defaultPort)

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
        if (!options.watch) {
          viteConfig.server.watch = null
        }

        hijackVitePluginInject(viteConfig)

        Object.defineProperty(viteConfig, '_vitest', {
          value: options,
          enumerable: false,
          configurable: true,
        })
      },
      configureServer: {
        // runs after vite:import-analysis as it relies on `server` instance on Vite 5
        order: 'post',
        async handler(server) {
          if (options.watch && process.env.VITE_TEST_WATCHER_DEBUG) {
            server.watcher.on('ready', () => {
              // eslint-disable-next-line no-console
              console.log('[debug] watcher is ready')
            })
          }
          await ctx._setServer(options, server, userConfig)
          if (options.api && options.watch) {
            (await import('../../api/setup')).setup(ctx)
          }

          // #415, in run mode we don't need the watcher, close it would improve the performance
          if (!options.watch) {
            await server.watcher.close()
          }
        },
      },
    },
    SsrReplacerPlugin(),
    ...CSSEnablerPlugin(ctx),
    CoverageTransform(ctx),
    VitestCoreResolver(ctx),
    options.ui ? await UIPlugin() : null,
    ...MocksPlugins(),
    VitestOptimizer(),
    NormalizeURLPlugin(),
  ].filter(notNullish)
}
function removeUndefinedValues<T extends Record<string, any>>(
  obj: T,
): T {
  for (const key in Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key]
    }
  }
  return obj
}
