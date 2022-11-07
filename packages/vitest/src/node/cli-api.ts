import { resolve } from 'pathe'
import type { UserConfig as ViteUserConfig } from 'vite'
import { EXIT_CODE_RESTART } from '../constants'
import { CoverageProviderMap } from '../integrations/coverage'
import { getEnvPackageName } from '../integrations/env'
import type { UserConfig, Vitest, VitestRunMode } from '../types'
import { ensurePackageInstalled } from '../utils'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
}

/**
 * Start Vitest programmatically
 *
 * Returns a Vitest instance if initialized successfully.
 */
export async function startVitest(
  mode: VitestRunMode,
  cliFilters: string[],
  options: CliOptions,
  viteOverrides?: ViteUserConfig,
): Promise<Vitest | undefined> {
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
    return
  }

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  const ctx = await createVitest(mode, options, viteOverrides)

  if (mode === 'test' && ctx.config.coverage.enabled) {
    const provider = ctx.config.coverage.provider || 'c8'
    if (typeof provider === 'string') {
      const requiredPackages = CoverageProviderMap[provider]

      if (!await ensurePackageInstalled(requiredPackages, root)) {
        process.exitCode = 1
        return ctx
      }
    }
  }

  const environmentPackage = getEnvPackageName(ctx.config.environment)

  if (environmentPackage && !await ensurePackageInstalled(environmentPackage, root)) {
    process.exitCode = 1
    return ctx
  }

  if (process.stdin.isTTY && ctx.config.watch)
    registerConsoleShortcuts(ctx)

  ctx.onServerRestart((reason) => {
    ctx.report('onServerRestart', reason)

    // if it's in a CLI wrapper, exit with a special code to request restart
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
    return ctx
  }

  if (ctx.config.watch)
    return ctx

  await ctx.close()
  return ctx
}
