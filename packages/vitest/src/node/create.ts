import { resolve } from 'pathe'
import { mergeConfig } from 'vite'
import type { InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { findUp } from 'find-up'
import type { UserConfig, VitestRunMode } from '../types'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'
import { createViteServer } from './vite'

export async function createVitest(mode: VitestRunMode, options: UserConfig, viteOverrides: ViteUserConfig = {}) {
  const ctx = new Vitest(mode)
  const root = resolve(options.root || process.cwd())

  const configPath = options.config === false
    ? false
    : options.config
      ? resolve(root, options.config)
      : await findUp(configFiles, { cwd: root } as any)

  options.config = configPath

  const config: ViteInlineConfig = {
    logLevel: 'error',
    configFile: configPath,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.mode || mode,
    plugins: await VitestPlugin(options, ctx),
  }

  const server = await createViteServer(mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })))

  if (ctx.config.api?.port)
    await server.listen()

  return ctx
}
