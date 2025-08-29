import type {
  InlineConfig as ViteInlineConfig,
  UserConfig as ViteUserConfig,
} from 'vite'
import type { CliOptions } from './cli/cli-api'
import type { VitestOptions } from './core'
import type { VitestRunMode } from './types/config'
import { resolve } from 'node:path'
import { deepClone, slash } from '@vitest/utils/helpers'
import { findUp } from 'find-up'
import { mergeConfig } from 'vite'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'
import { createViteServer } from './vite'

export async function createVitest(
  mode: VitestRunMode,
  options: CliOptions,
  viteOverrides: ViteUserConfig = {},
  vitestOptions: VitestOptions = {},
): Promise<Vitest> {
  const ctx = new Vitest(mode, deepClone(options), vitestOptions)
  const root = slash(resolve(options.root || process.cwd()))

  const configPath
    = options.config === false
      ? false
      : options.config
        ? resolve(root, options.config)
        : await findUp(configFiles, { cwd: root } as any)

  options.config = configPath

  const { browser: _removeBrowser, ...restOptions } = options

  const config: ViteInlineConfig = {
    configFile: configPath,
    configLoader: options.configLoader,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.mode || mode,
    plugins: await VitestPlugin(restOptions, ctx),
  }

  const server = await createViteServer(
    mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })),
  )

  if (ctx.config.api?.port) {
    await server.listen()
  }

  return ctx
}
