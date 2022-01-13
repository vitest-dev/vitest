import { resolve } from 'pathe'
import { createServer, mergeConfig } from 'vite'
import type { InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { findUp } from 'find-up'
import type { UserConfig } from '../types'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './vite-plugin'

export async function createVitest(options: UserConfig, viteOverrides: ViteUserConfig = {}) {
  const ctx = new Vitest()
  const root = resolve(options.root || process.cwd())

  const configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root } as any)

  const config: ViteInlineConfig = {
    root,
    logLevel: 'error',
    configFile: configPath,
    plugins: await VitestPlugin(options, viteOverrides, ctx),
  }

  const server = await createServer(mergeConfig(config, viteOverrides))
  await server.pluginContainer.buildStart({})

  if (ctx.config.api?.port)
    await server.listen()

  return ctx
}
