import type { Plugin as VitePlugin } from 'vite'
import type { UserConfig } from '../../types'
import { deepMerge, ensurePackageInstalled, notNullish } from '../../utils'
import { resolveApiConfig } from '../config'
import { Vitest } from '../core'
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
        options = deepMerge(options, viteConfig.test || {})
        options.api = resolveApiConfig(options)
        return {
          clearScreen: false,
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
          },
          server: {
            ...options.api,
            open: options.ui && options.open
              ? options.uiBase ?? '/__vitest__/'
              : undefined,
            preTransformRequests: false,
          },
          build: {
            sourcemap: true,
          },
          optimizeDeps: false,
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
    MocksPlugin(),
    GlobalSetupPlugin(ctx),
    options.ui
      ? await UIPlugin()
      : null,
  ]
    .filter(notNullish)
}
