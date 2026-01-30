import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { ResolvedConfig, UserConfig } from '../types/config'
import { deepClone, deepMerge, notNullish } from '@vitest/utils/helpers'
import { relative, resolve } from 'pathe'
import * as vite from 'vite'
import { defaultPort } from '../../constants'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { resolveApiServerConfig } from '../config/resolveConfig'
import { Vitest } from '../core'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
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

export async function VitestPlugin(
  options: UserConfig = {},
  vitest: Vitest = new Vitest('test', deepClone(options)),
): Promise<VitePlugin[]> {
  const userConfig = deepMerge({}, options) as UserConfig

  async function UIPlugin() {
    await vitest.packageInstaller.ensureInstalled('@vitest/ui', resolve(options.root || process.cwd()), vitest.version)
    return (await import('@vitest/ui')).default(vitest)
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

        // inherit so it's available in VitestOptimizer
        // I cannot wait to rewrite all of this in Vitest 4
        if (options.cache != null) {
          config.test!.cache = options.cache
        }

        if (vitest.configOverride.project) {
          // project filter was set by the user, so we need to filter the project
          options.project = vitest.configOverride.project
        }

        config.customLogger = createViteLogger(
          vitest.logger,
          viteConfig.logLevel || 'warn',
          {
            allowClearScreen: false,
          },
        )
        config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

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
              const root = vitest.config.root || options.root || process.cwd()
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
        const viteConfigTest = (viteConfig.test as UserConfig) || {}
        if (viteConfigTest.watch === false) {
          ;(viteConfigTest as any).run = true
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

        if (options.ui) {
          // @ts-expect-error mutate readonly
          viteConfig.plugins.push(await UIPlugin())
        }

        Object.defineProperty(viteConfig, '_vitest', {
          value: options,
          enumerable: false,
          configurable: true,
        })

        const originalName = options.name
        if (options.browser?.instances) {
          options.browser.instances.forEach((instance) => {
            instance.name ??= originalName ? `${originalName} (${instance.browser})` : instance.browser
          })
        }
      },
      configureServer: {
        async handler(server) {
          if (options.watch && process.env.VITE_TEST_WATCHER_DEBUG) {
            server.watcher.on('ready', () => {
              // eslint-disable-next-line no-console
              console.log('[debug] watcher is ready')
            })
          }
          await vitest._setServer(options, server)
          if (options.api && options.watch) {
            (await import('../../api/setup')).setup(vitest)
          }

          // #415, in run mode we don't need the watcher, close it would improve the performance
          if (!options.watch) {
            await server.watcher.close()
          }
        },
      },
    },
    MetaEnvReplacerPlugin(),
    ...CSSEnablerPlugin(vitest),
    CoverageTransform(vitest),
    VitestCoreResolver(vitest),
    ...MocksPlugins(),
    VitestOptimizer(),
    NormalizeURLPlugin(),
    ModuleRunnerTransform(),
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
