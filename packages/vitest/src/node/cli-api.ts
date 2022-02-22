import { execa } from 'execa'
import type { UserConfig as ViteUserConfig } from 'vite'
import c from 'picocolors'
import type { UserConfig } from '../types'
import { ensurePackageInstalled } from '../utils'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'
import { printError } from './reporters/renderers/diff'
import { divider } from './reporters/renderers/utils'

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

  if (!await ensurePackageInstalled('vite')) {
    process.exitCode = 1
    return false
  }

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  const ctx = await createVitest(options, viteOverrides)

  if (ctx.config.coverage.enabled) {
    if (!await ensurePackageInstalled('c8')) {
      process.exitCode = 1
      return false
    }

    if (!process.env.NODE_V8_COVERAGE) {
      process.env.NODE_V8_COVERAGE = ctx.config.coverage.tempDirectory
      const { exitCode } = await execa(process.argv0, process.argv.slice(1), { stdio: 'inherit', reject: false })
      process.exitCode = exitCode
      return false
    }
  }

  if (ctx.config.environment && ctx.config.environment !== 'node') {
    if (!await ensurePackageInstalled(ctx.config.environment)) {
      process.exitCode = 1
      return false
    }
  }

  if (process.stdin.isTTY && ctx.config.watch)
    registerConsoleShortcuts(ctx)

  process.chdir(ctx.config.root)

  ctx.onServerRestarted(() => {
    // TODO: re-consider how to re-run the tests the server smartly
    ctx.start(cliFilters)
  })

  try {
    await ctx.start(cliFilters)
  }
  catch (e) {
    process.exitCode = 1
    ctx.error(`\n${c.red(divider(c.bold(c.inverse(' Unhandled Error '))))}`)
    await printError(e, ctx)
    ctx.error('\n\n')
  }

  if (!ctx.config.watch) {
    await ctx.exit()
    return !process.exitCode
  }

  return true
}
