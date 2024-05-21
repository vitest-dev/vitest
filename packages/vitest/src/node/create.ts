import { resolve } from 'pathe'
import { createServer, mergeConfig } from 'vite'
import type { InlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { findUp } from 'find-up'
import type { UserConfig, VitestRunMode } from '../types'
import { configFiles } from '../constants'
import type { VitestOptions } from './core'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'

export async function createVitest(mode: VitestRunMode, cliOptions: UserConfig, viteOverrides: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const root = resolve(cliOptions.root || process.cwd())

  const configPath = cliOptions.config === false
    ? false
    : cliOptions.config
      ? resolve(root, cliOptions.config)
      : await findUp(configFiles, { cwd: root } as any)

  cliOptions.config = configPath

  const ctx = new Vitest(mode, vitestOptions)

  const config: InlineConfig = {
    logLevel: 'error',
    mode: cliOptions.mode || mode,
    configFile: configPath,
    plugins: await VitestPlugin(cliOptions, ctx),
  }

  const server = await createServer(
    mergeConfig(config, mergeConfig(viteOverrides, { root: cliOptions.root })),
  )

  if (ctx.config.api?.port)
    await server.listen()

  return ctx
}
