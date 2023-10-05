import { resolve } from 'pathe'
import type { UserConfig as ViteUserConfig } from 'vite'
import { EXIT_CODE_RESTART } from '../constants'
import { CoverageProviderMap } from '../integrations/coverage'
import { getEnvPackageName } from '../integrations/env'
import type { CollectedTests, UserConfig, Vitest, VitestRunMode } from '../types'
import { ensurePackageInstalled } from './pkg'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean

  /**
   * During collection, this can be set to "true" to output tests in a json format
   */
  json?: string | boolean
}

/**
 * Start Vitest programmatically
 *
 * Returns a Vitest instance if initialized successfully.
 */
async function executeVitest(
  callback: (ctx: Vitest) => Promise<unknown>,
  mode: VitestRunMode,
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
): Promise<Vitest> {
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= options.mode || 'test'

  if (options.run)
    options.watch = false

  // this shouldn't affect _application root_ that can be changed inside config
  const root = resolve(options.root || process.cwd())

  if (!await ensurePackageInstalled('vite', root)) {
    process.exitCode = 1
    throw new Error('Vitest requires "vite" to be installed in the project root.')
  }

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  // running "vitest --browser", assumes browser name is set in the config
  if (typeof options.browser === 'boolean')
    options.browser = { enabled: options.browser } as any

  // running "vitest --browser=chrome"
  if (typeof options.browser === 'string')
    options.browser = { enabled: true, name: options.browser }

  // running "vitest --browser.headless"
  if (typeof options.browser === 'object' && !('enabled' in options.browser))
    options.browser.enabled = true

  const ctx = await createVitest(mode, options, viteOverrides)

  if (mode === 'test' && ctx.config.coverage.enabled) {
    const provider = ctx.config.coverage.provider || 'v8'
    const requiredPackages = CoverageProviderMap[provider]

    if (requiredPackages) {
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

  let stdinCleanup
  if (process.stdin.isTTY)
    stdinCleanup = registerConsoleShortcuts(ctx)

  ctx.onServerRestart((reason) => {
    ctx.report('onServerRestart', reason)

    // if it's in a CLI wrapper, exit with a special code to request restart
    if (process.env.VITEST_CLI_WRAPPER)
      process.exit(EXIT_CODE_RESTART)
  })

  ctx.onAfterSetServer(() => {
    ctx.start(cliFilters)
  })

  try {
    await callback(ctx)
  }
  catch (e) {
    process.exitCode = 1
    await ctx.logger.printError(e, { fullStack: true, type: 'Unhandled Error' })
    ctx.logger.error('\n\n')
    return ctx
  }

  if (ctx.shouldKeepServer())
    return ctx

  stdinCleanup?.()
  await ctx.close()
  return ctx
}

export async function startVitest(
  mode: VitestRunMode,
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
) {
  return executeVitest(
    ctx => ctx.start(cliFilters),
    mode,
    cliFilters,
    options,
    viteOverrides,
  )
}

export function collectTests(
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
) {
  options.run = true
  options.watch = false

  // don't isolate test files in collect mode by default to improve speed, but allow overwrite
  options.poolOptions ??= {}
  options.poolOptions.threads ??= {}
  options.poolOptions.threads.isolate ??= false
  options.poolOptions.forks ??= {}
  options.poolOptions.forks.isolate ??= false

  return new Promise<CollectedTests>((resolve, reject) => {
    executeVitest(
      async (ctx) => {
        if (ctx.config.browser)
          ctx.config.browser.isolate = options.browser?.isolate ?? false
        const tests = await ctx.collect(cliFilters)
        resolve(tests)
      },
      'test',
      cliFilters,
      options,
      viteOverrides,
    ).catch(reject)
  })
}
