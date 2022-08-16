import { resolve } from 'pathe'
import type { UserConfig as ViteUserConfig } from 'vite'
import { EXIT_CODE_RESTART } from '../constants'
import { CoverageProviderMap } from '../integrations/coverage'
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
  if (options.browser) // enabling threads in browser mode causes inconsistences
    options.threads = false

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
    const provider = ctx.config.coverage.provider || 'c8'
    if (typeof provider === 'string') {
      const requiredPackages = CoverageProviderMap[provider]

      if (!await ensurePackageInstalled(requiredPackages, root)) {
        process.exitCode = 1
        return false
      }
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

  ctx.onServerRestart((reason) => {
    ctx.report('onServerRestart', reason)

    if (process.env.VITEST_CLI_WRAPPER)
      process.exit(EXIT_CODE_RESTART)
    else
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
