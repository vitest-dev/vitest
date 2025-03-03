import type {
  InlineConfig as ViteInlineConfig,
  UserConfig as ViteUserConfig,
} from 'vite'
import type { VitestOptions } from './core'
import type { UserConfig, VitestRunMode } from './types/config'
import { resolve } from 'node:path'
import { slash } from '@vitest/utils'
import { findUp } from 'find-up'
import { mergeConfig } from 'vite'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'
import { createViteServer } from './vite'

/**
 * Extends `UserConfig` with certain Vite options that can be passed, for example, via the CLI.
 */
export interface CreateVitestOptions extends UserConfig {
  configLoader?: ViteInlineConfig['configLoader']
}

export async function createVitest(
  mode: VitestRunMode,
  options: CreateVitestOptions,
  viteOverrides: ViteUserConfig = {},
  vitestOptions: VitestOptions = {},
): Promise<Vitest> {
  const ctx = new Vitest(mode, vitestOptions)
  const root = slash(resolve(options.root || process.cwd()))

  const configPath
    = options.config === false
      ? false
      : options.config
        ? resolve(root, options.config)
        : await findUp(configFiles, { cwd: root } as any)

  options.config = configPath

  const config: ViteInlineConfig = {
    configFile: configPath,
    configLoader: options.configLoader,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.mode || mode,
    plugins: await VitestPlugin(options, ctx),
  }

  const server = await createViteServer(
    mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })),
  )

  if (ctx.config.api?.port) {
    await server.listen()
  }

  return ctx
}
