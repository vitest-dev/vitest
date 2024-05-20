import { resolve } from 'pathe'
import { mergeConfig, resolveConfig } from 'vite'
import type { UserConfig as ViteUserConfig } from 'vite'
import { findUp } from 'find-up'
import type { UserConfig, ViteResolvedConfig, VitestRunMode } from '../types'
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

  const config = await resolveConfig({
    logLevel: 'error',
    mode: cliOptions.mode || mode,
    test: cliOptions,
    configFile: configPath,
    plugins: await VitestPlugin(cliOptions, ctx),
  }, 'serve') as ViteResolvedConfig

  const resolvedConfig = mergeConfig(
    config,
    mergeConfig(viteOverrides, { root: cliOptions.root }),
  ) as ViteResolvedConfig

  await ctx.resolve(resolvedConfig, cliOptions)

  return ctx
}
