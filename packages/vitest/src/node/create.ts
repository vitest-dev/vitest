import type {
  InlineConfig as ViteInlineConfig,
  UserConfig as ViteUserConfig,
} from 'vite'
import type { CliOptions } from './cli/cli-api'
import type { VitestOptions } from './core'
import type { VitestRunMode } from './types/config'
import { resolve } from 'node:path'
import { deepClone, slash } from '@vitest/utils/helpers'
import * as find from 'empathic/find'
import { resolveModule } from 'local-pkg'
import { mergeConfig } from 'vite'
import { configFiles } from '../constants'
import { Vitest } from './core'
import { VitestPlugin } from './plugins'
import { createViteServer } from './vite'

export async function createVitest(
  options: CliOptions,
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
/**
 * @deprecated The `mode` argument is no longer used. Use `createVitest(options, viteOverrides?, vitestOptions?)` instead.
 */
export async function createVitest(
  mode: VitestRunMode,
  options: CliOptions,
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
export async function createVitest(
  modeOrOptions: VitestRunMode | CliOptions,
  optionsOrViteOverrides: CliOptions | ViteUserConfig = {},
  viteOverridesOrVitestOptions: ViteUserConfig | VitestOptions = {},
  maybeVitestOptions: VitestOptions = {},
): Promise<Vitest> {
  let options: CliOptions
  let viteOverrides: ViteUserConfig
  let vitestOptions: VitestOptions
  if (typeof modeOrOptions === 'string') {
    options = optionsOrViteOverrides as CliOptions
    viteOverrides = viteOverridesOrVitestOptions as ViteUserConfig
    vitestOptions = maybeVitestOptions
  }
  else {
    options = modeOrOptions
    viteOverrides = optionsOrViteOverrides as ViteUserConfig
    vitestOptions = viteOverridesOrVitestOptions as VitestOptions
  }
  const ctx = new Vitest(deepClone(options), vitestOptions)
  const root = slash(resolve(options.root || process.cwd()))

  const configPath
    = options.config === false
      ? false
      : options.config
        ? (resolveModule(options.config, { paths: [root] }) ?? resolve(root, options.config))
        : find.any(configFiles, { cwd: root })

  options.config = configPath

  const { browser: _removeBrowser, ...restOptions } = options

  const config: ViteInlineConfig = {
    configFile: configPath,
    configLoader: options.configLoader,
    mode: options.mode || 'test',
    plugins: await VitestPlugin(restOptions, ctx),
  }

  try {
    const server = await createViteServer(
      mergeConfig(config, mergeConfig(viteOverrides, { root: options.root })),
    )

    if (ctx.config.api?.port) {
      await server.listen()
    }

    return ctx
  }
  // Vitest can fail at any point inside "setServer" or inside a custom plugin
  // Then we need to make sure everything was properly closed (like the logger)
  catch (error) {
    await ctx.close()
    throw error
  }
}
