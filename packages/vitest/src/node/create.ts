import { readFileSync } from 'fs'
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

  let configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root } as any)

  let jsonConfig = {}
  if (configPath && configPath.endsWith('json')) {
    jsonConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
    configPath = undefined
  }

  const config: ViteInlineConfig = {
    logLevel: 'error',
    configFile: configPath,
    // this will make "mode" = "test" inside defineConfig
    mode: options.mode || process.env.NODE_ENV || mode,
    plugins: await VitestPlugin(options, ctx),
  }

  const server = await createServer(mergeConfig(config, mergeConfig(jsonConfig, mergeConfig(viteOverrides, { root: options.root }))))
  if (ctx.config.api?.port)
    await server.listen()
  else
    await server.pluginContainer.buildStart({})

  return ctx
}
