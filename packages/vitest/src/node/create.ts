import type {
  InlineConfig as ViteInlineConfig,
  UserConfig as ViteUserConfig,
} from 'vite'
import type { CliOptions } from './cli/cli-api'
import type { VitestOptions } from './core'
import type { VitestRunMode } from './types/config'
import { statSync } from 'node:fs'
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
  mode: VitestRunMode,
  options: CliOptions,
  viteOverrides: ViteUserConfig = {},
  vitestOptions: VitestOptions = {},
): Promise<Vitest> {
  const ctx = new Vitest(mode, deepClone(options), vitestOptions)
  const root = resolveRoot(options.root)

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
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.mode || mode,
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

function resolveRoot(root: string | undefined): string {
  const resolvedRoot = slash(resolve(root || process.cwd()))

  if (root) {
    let stats
    try {
      stats = statSync(resolvedRoot)
    }
    catch {
      throw new Error(`Root directory does not exist: ${resolvedRoot}`)
    }

    if (!stats.isDirectory()) {
      throw new Error(`Root is not a directory: ${resolvedRoot}`)
    }
  }

  return resolvedRoot
}
