import type { Plugin as VitePlugin } from 'vite'
import { configDefaults } from '../../defaults'
import type { ResolvedConfig, UserConfig } from '../../types'
import { deepMerge, ensurePackageInstalled, notNullish } from '../../utils'
import { resolveApiConfig } from '../config'
import { Vitest } from '../core'
import { EnvReplacerPlugin } from './envRelacer'
import { GlobalSetupPlugin } from './globalSetup'
import { MocksPlugin } from './mock'

export async function VitestPlugin(options: UserConfig = {}, ctx = new Vitest()): Promise<VitePlugin[]> {
  let haveStarted = false

  async function UIPlugin() {
    await ensurePackageInstalled('@vitest/ui')
    return (await import('@vitest/ui')).default(options.uiBase)
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

        return {
          clearScreen: false,
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
          },
          server: {
            ...preOptions.api,
            open: preOptions.ui && preOptions.open
              ? preOptions.uiBase ?? '/__vitest__/'
              : undefined,
            preTransformRequests: false,
          },
          // disable deps optimization
          cacheDir: undefined,
        }
      },
      async configResolved(viteConfig) {
        const viteConfigTest = (viteConfig.test as any) || {}
        if (viteConfigTest.watch === false)
          viteConfigTest.run = true

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
        await ctx.setServer(options, server)
        haveStarted = true
        if (options.api && options.watch)
          (await import('../../api/setup')).setup(ctx)

        // #415, in run mode we don't need the watcher, close it would improve the performance
        if (!options.watch)
          await server.watcher.close()
      },
    },
    EnvReplacerPlugin(),
    MocksPlugin(),
    GlobalSetupPlugin(ctx),
    options.ui
      ? await UIPlugin()
      : null,
  ]
    .filter(notNullish)
}
