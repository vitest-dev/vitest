import { resolve } from 'pathe'
import type { UserConfig as ViteUserConfig } from 'vite'
import { envPackageNames } from '../integrations/env'
import type { UserConfig } from '../types'
import { ensurePackageInstalled } from '../utils'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
}

export async function startVitest(cliFilters: string[], options: CliOptions, viteOverrides?: ViteUserConfig) {
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= options.mode || 'test'

  if (options.run)
    options.watch = false

  // this shouldn't affect _application root_ that can be changed inside config
  const root = resolve(options.root || process.cwd())

  if (!await ensurePackageInstalled('vite', root)) {
    process.exitCode = 1
    return false
  }

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  const ctx = await createVitest(options, viteOverrides)

  if (ctx.config.coverage.enabled) {
    if (!await ensurePackageInstalled('c8', root)) {
      process.exitCode = 1
      return false
    }
  }

  if (ctx.config.environment && ctx.config.environment !== 'node') {
    const packageName = envPackageNames[ctx.config.environment]
    if (!await ensurePackageInstalled(packageName, root)) {
      process.exitCode = 1
      return false
    }
  }

  if (process.stdin.isTTY && ctx.config.watch)
    registerConsoleShortcuts(ctx)

  ctx.onServerRestarted(() => {
    // TODO: re-consider how to re-run the tests the server smartly
    ctx.start(cliFilters)
  })

  try {
    await ctx.start(cliFilters)
  }
  catch (e) {
    process.exitCode = 1
    await ctx.logger.printError(e, true, 'Unhandled Error')
    ctx.logger.error('\n\n')
    return false
  }

  if (!ctx.config.watch) {
    await ctx.exit()
    return !process.exitCode
  }

  return true
}
