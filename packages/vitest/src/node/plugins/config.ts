import type { Plugin, UserConfig as ViteConfig } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig } from '../types/config'
import { relative } from 'pathe'
import * as vite from 'vite'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
import { VitestOptimizer } from './optimizer'
import { ModuleRunnerTransform } from './runnerTransform'
import { deleteDefineConfig, getDefaultResolveOptions } from './utils'

export function VitestConfig(harness: PluginHarness): Plugin[] {
  let root: string
  return [
    {
      name: 'vitest:config',
      enforce: 'pre',
      configResolved(config) {
        root = config.root
      },
      config(viteConfig) {
        const testConfig = viteConfig.test || {}
        const resolveOptions = getDefaultResolveOptions()
        const browserEnabled = !!testConfig.browser?.enabled

        if (viteConfig.define) {
          delete viteConfig.define['import.meta.vitest']
        }

        // move `test.alias` to Vite's `resolve.alias`
        const alias = testConfig.alias
        delete testConfig.alias

        // We inject the defines string in non-browser tests,
        // But keep the original behaviour in the browser mode
        const defines = browserEnabled
          ? viteConfig.define
          : deleteDefineConfig(viteConfig)

        const config: ViteConfig = browserEnabled
          ? {
              resolve: {
                alias,
              },
              test: {},
            }
          : {
              define: {
                // disable replacing `process.env.NODE_ENV` with static string by vite:client-inject
                'process.env.NODE_ENV': 'process.env.NODE_ENV',
              },
              resolve: {
                ...resolveOptions,
                alias,
              },
              test: {},
            }

        config.environments = {
          ssr: {
            resolve: resolveOptions,
          },
          __vitest__: {
            dev: {},
            resolve: resolveOptions,
          },
        }

        ;(config.test as ResolvedConfig).defines = defines || {}

        if ('rolldownVersion' in vite) {
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore rolldown-vite only
          config.oxc = viteConfig.oxc === false
            ? false
            : {
                // eslint-disable-next-line ts/ban-ts-comment
                // @ts-ignore rolldown-vite only
                target: viteConfig.oxc?.target || 'node18',
              }
        }
        else {
          config.esbuild = viteConfig.esbuild === false
            ? false
            : {
                // Lowest target Vitest supports is Node18
                target: viteConfig.esbuild?.target || 'node18',
                sourcemap: 'external',
                // Enables using ignore hint for coverage providers with @preserve keyword
                legalComments: 'inline',
              }
        }

        const classNameStrategy
          = (typeof testConfig.css !== 'boolean'
            && testConfig.css?.modules?.classNameStrategy)
          || 'stable'

        if (!browserEnabled && classNameStrategy !== 'scoped') {
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
                relative(root, filename),
              )!
            }
          }
        }

        config.customLogger = createViteLogger(
          harness.logger,
          viteConfig.logLevel || 'warn',
          {
            allowClearScreen: false,
          },
        )
        config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

        return config
      },
    },
    VitestOptimizer(),
    ModuleRunnerTransform(),
  ]
}
