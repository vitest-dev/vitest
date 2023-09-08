import { resolve } from 'pathe'
import { createServer, mergeConfig } from 'vite'
import type { InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { findUp } from 'find-up'
import type { UserConfig, VitestRunMode } from '../types'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'

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
    // this will make "mode" = "test" inside defineConfig
    mode: options.mode || process.env.NODE_ENV || mode,
    plugins: await VitestPlugin(options, ctx),
  }

  // Vite prints an error (https://github.com/vitejs/vite/issues/14328)
  // But Vitest works correctly either way
  const error = console.error
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('WebSocket server error:'))
      return
    error(...args)
  }

  const server = await createServer(mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })))

  if (ctx.config.api?.port)
    await server.listen()

  console.error = error

  return ctx
}
