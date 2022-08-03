import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { configDefaults } from '../../defaults'
import type { ResolvedConfig, UserConfig } from '../../types'
import { deepMerge, ensurePackageInstalled, notNullish } from '../../utils'
import { resolveApiConfig } from '../config'
import { Vitest } from '../core'
import { EnvReplacerPlugin } from './envRelacer'
import { GlobalSetupPlugin } from './globalSetup'
import { MocksPlugin } from './mock'
import { CSSEnablerPlugin } from './cssEnabler'

export async function VitestPlugin(options: UserConfig = {}, ctx = new Vitest()): Promise<VitePlugin[]> {
  let haveStarted = false

  async function UIPlugin() {
    await ensurePackageInstalled('@vitest/ui', ctx.config?.root || options.root || process.cwd())
    return (await import('@vitest/ui')).default(options.uiBase)
  }

  async function BrowserPlugin() {
    await ensurePackageInstalled('@vitest/browser', ctx.config?.root || options.root || process.cwd())
    return (await import('@vitest/browser')).default('/')
  }

  return [
    <VitePlugin>{
      name: 'vitest',
      enforce: 'pre',
      config(viteConfig: any) {
        // preliminary merge of options to be able to create server options for vite
        // however to allow vitest plugins to modify vitest config values
        // this is repeated in configResolved where the config is final
        const preOptions = deepMerge({}, configDefaults, options, viteConfig.test ?? {})
        preOptions.api = resolveApiConfig(preOptions)

        if (viteConfig.define) {
          delete viteConfig.define['import.meta.vitest']
          delete viteConfig.define['process.env']
        }

        // store defines for globalThis to make them
        // reassignable when running in worker in src/runtime/setup.ts
        const defines: Record<string, any> = {}

        for (const key in viteConfig.define) {
          const val = viteConfig.define[key]
          let replacement: any
          try {
            replacement = typeof val === 'string' ? JSON.parse(val) : val
          }
          catch {
            // probably means it contains reference to some variable,
            // like this: "__VAR__": "process.env.VAR"
            continue
          }
          if (key.startsWith('import.meta.env.')) {
            const envKey = key.slice('import.meta.env.'.length)
            process.env[envKey] = replacement
            delete viteConfig.define[key]
          }
          else if (key.startsWith('process.env.')) {
            const envKey = key.slice('process.env.'.length)
            process.env[envKey] = replacement
            delete viteConfig.define[key]
          }
          else if (!key.includes('.')) {
            defines[key] = replacement
            delete viteConfig.define[key]
          }
        }

        (options as ResolvedConfig).defines = defines

        let open: string | boolean | undefined

        if (preOptions.ui && preOptions.open)
          open = preOptions.uiBase ?? '/__vitest__/'
        else if (preOptions.browser)
          open = '/'

        const config: ViteConfig = {
          resolve: {
            alias: preOptions.alias,
          },
          server: {
            ...preOptions.api,
            watch: {
              ignored: preOptions.watchExclude,
            },
            open,
            hmr: false,
            preTransformRequests: false,
          },
        }

        if (!options.browser) {
          // disable deps optimization
          Object.assign(config, {
            cacheDir: undefined,
            optimizeDeps: {
              // experimental in Vite >2.9.2, entries remains to help with older versions
              disabled: true,
              entries: [],
            },
          })
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
        options.api = resolveApiConfig(options)

        // we replace every "import.meta.env" with "process.env"
        // to allow reassigning, so we need to put all envs on process.env
        const { PROD, DEV, ...envs } = viteConfig.env

        // process.env can have only string values and will cast string on it if we pass other type,
        // so we are making them truthy
        process.env.PROD ??= PROD ? '1' : ''
        process.env.DEV ??= DEV ? '1' : ''
        process.env.SSR ??= '1'

        for (const name in envs)
          process.env[name] ??= envs[name]
      },
      async configureServer(server) {
        if (haveStarted)
          await ctx.report('onServerRestart')
        try {
          await ctx.setServer(options, server)
          haveStarted = true
          if (options.api && options.watch)
            (await import('../../api/setup')).setup(ctx)
        }
        catch (err) {
          ctx.logger.printError(err, true)
          process.exit(1)
        }

        // #415, in run mode we don't need the watcher, close it would improve the performance
        if (!options.watch)
          await server.watcher.close()
      },
    },
    EnvReplacerPlugin(),
    MocksPlugin(),
    GlobalSetupPlugin(ctx),
    ...(options.browser
      ? await BrowserPlugin()
      : []),
    CSSEnablerPlugin(ctx),
    options.ui
      ? await UIPlugin()
      : null,
  ]
    .filter(notNullish)
}
