import type { Plugin as VitePlugin } from 'vite'
import { configDefaults } from '../../defaults'
import type { UserConfig } from '../../types'
import { deepMerge, ensurePackageInstalled, notNullish } from '../../utils'
import { resolveApiConfig } from '../config'
import { Vitest } from '../core'
import { GlobalSetupPlugin } from './globalSetup'
import { MocksPlugin } from './mock'
import { EnvReplacerPlugin } from './envReplacer'

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
        const preOptions = deepMerge({}, options, viteConfig.test ?? {})
        preOptions.api = resolveApiConfig(preOptions)

        return {
          // we are setting NODE_ENV when running CLI to 'test',
          // but it can be overridden
          mode: viteConfig.mode || process.env.NODE_ENV || 'test',
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

        process.env.BASE_URL ??= viteConfig.base
        process.env.MODE ??= viteConfig.mode
        // process.env can have only string values and will cast string on it if we pass other type,
        // so we are making them truthy
        process.env.PROD ??= viteConfig.env.PROD ? '1' : ''
        process.env.DEV ??= viteConfig.env.DEV ? '1' : ''
        process.env.SSR ??= '1'

        // account for user env defines
        for (const key in viteConfig.define) {
          if (key.startsWith('import.meta.env.')) {
            const val = viteConfig.define[key]
            const envKey = key.slice('import.meta.env.'.length)
            process.env[envKey] = typeof val === 'string' ? JSON.parse(val) : val
          }
        }
      },
      async configureServer(server) {
        if (haveStarted)
          await ctx.report('onServerRestart')
        await ctx.setServer(options, server)
        haveStarted = true
        if (options.api)
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
