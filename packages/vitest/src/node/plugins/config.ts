import type { Plugin, ServerOptions, UserConfig as ViteUserConfig } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedApiConfig } from '../types/config'
import { relative } from 'pathe'
import * as vite from 'vite'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
import { VitestOptimizer } from './optimizer'
import { ModuleRunnerTransform } from './runnerTransform'
import { getDefaultResolveOptions } from './utils'

export function ViteConfigPlugin(harness: PluginHarness): Plugin[] {
  let root: string
  return [
    {
      name: 'vitest:config:server-defaults',
      config: {
        // These static server toggles must be visible to other plugins that
        // read `server.hmr` in their own `config` hook: `@vitejs/plugin-react`
        // turns React Fast Refresh off only when it sees HMR disabled.
        // A `post` hook (in `vitest:config:server`) runs after such plugins,
        // so set them here in a `pre` hook instead.
        order: 'pre',
        handler() {
          return {
            server: {
              hmr: false,
              open: false,
            },
          }
        },
      },
    },
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

        // move `test.alias` to Vite's `resolve.alias`
        const alias = testConfig.alias
        delete testConfig.alias

        const config: ViteUserConfig = browserEnabled
          ? {
              resolve: {
                alias,
              },
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
    {
      name: 'vitest:config:server',
      enforce: 'post',
      config: {
        order: 'post',
        handler(viteConfig) {
          // `vitest:test-config` has resolved `test.api` by now: both hooks
          // have the same order and `TestConfigPlugin` always comes earlier
          const testConfig = viteConfig.test ?? {}
          const isBrowserEnabled = !!testConfig.browser?.enabled
          const api = testConfig.api as ResolvedApiConfig

          const server: ServerOptions = {
            ...api,
          }
          if (!isBrowserEnabled) {
            server.preTransformRequests = false
          }

          // Always disable the websocket server in middlewareMode
          if (!isBrowserEnabled && api.middlewareMode) {
            server.ws = false
          }
          else if (viteConfig.server && 'ws' in viteConfig.server) {
            viteConfig.server.ws = undefined
          }

          return {
            server,
          }
        },
      },
    },
    VitestOptimizer(),
    ModuleRunnerTransform(),
  ]
}
