import { createServer, mergeConfig } from 'vite'
import type { InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig, VitestRunMode } from '../types'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'
import { resolveConfigPath } from './config'

export async function createVitest(mode: VitestRunMode, options: UserConfig, viteOverrides: ViteUserConfig = {}) {
  const ctx = new Vitest(mode)

  const configFile = await resolveConfigPath(options)
  options.config = configFile

  const config: ViteInlineConfig = {
    logLevel: 'error',
    configFile,
    // this will make "mode" = "test" inside defineConfig
    mode: options.mode || process.env.NODE_ENV || mode,
    plugins: await VitestPlugin(options, ctx),
  }

  const server = await createServer(mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })))

  // optimizer needs .listen() to be called
  if (ctx.config.api?.port || ctx.config.deps?.optimizer?.web?.enabled || ctx.config.deps?.optimizer?.ssr?.enabled)
    await server.listen()
  else
    await server.pluginContainer.buildStart({})

  return ctx
}
