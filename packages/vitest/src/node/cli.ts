import cac from 'cac'
import { execa } from 'execa'
import type { UserConfig } from '../types'
import { version } from '../../package.json'
import { ensurePackageInstalled } from '../utils'
import { createVitest } from './create'
import { registerConsoleShortcuts } from './stdin'

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'root path')
  .option('-c, --config <path>', 'path to config file')
  .option('-u, --update', 'update snapshot')
  .option('-w, --watch', 'watch mode')
  .option('-t, --testNamePattern <pattern>', 'run test names with the specified pattern')
  .option('--ui', 'enable UI')
  .option('--open', 'open UI automatically (default: !process.env.CI))')
  .option('--api [api]', 'serve API, available options: --api.port <port>, --api.host [host] and --api.strictPort')
  .option('--threads', 'enabled threads (default: true)')
  .option('--silent', 'silent console output from tests')
  .option('--isolate', 'isolate environment for each test file (default: true)')
  .option('--reporter <name>', 'reporter')
  .option('--outputFile <filename>', 'write test results to a file when the --reporter=json option is also specified')
  .option('--coverage', 'use c8 for coverage')
  .option('--run', 'do not watch')
  .option('--globals', 'inject apis globally')
  .option('--global', 'deprecated, use --globals')
  .option('--dom', 'mock browser api with happy-dom')
  .option('--environment <env>', 'runner environment (default: node)')
  .option('--passWithNoTests', 'pass when no tests found')
  .option('--allowOnly', 'Allow tests and suites that are marked as only (default: !process.env.CI)')
  .help()

cli
  .command('run [...filters]')
  .action(run)

cli
  .command('related [...filters]')
  .action(runRelated)

cli
  .command('watch [...filters]')
  .action(start)

cli
  .command('dev [...filters]')
  .action(start)

cli
  .command('[...filters]')
  .action(start)

cli.parse()

export interface CliOptions extends UserConfig {
  /**
   * Override the watch mode
   */
  run?: boolean
}

async function runRelated(relatedFiles: string[] | string, argv: CliOptions) {
  argv.related = relatedFiles
  argv.passWithNoTests ??= true
  await start([], argv)
}

async function run(cliFilters: string[], options: CliOptions) {
  options.run = true
  await start(cliFilters, options)
}

async function start(cliFilters: string[], options: CliOptions) {
  process.env.VITEST = 'true'
  process.env.NODE_ENV = 'test'

  if (options.run)
    options.watch = false

  if (!await ensurePackageInstalled('vite'))
    process.exit(1)

  if (typeof options.coverage === 'boolean')
    options.coverage = { enabled: options.coverage }

  const ctx = await createVitest(options)

  if (ctx.config.coverage.enabled) {
    if (!await ensurePackageInstalled('c8'))
      process.exit(1)

    if (!process.env.NODE_V8_COVERAGE) {
      process.env.NODE_V8_COVERAGE = ctx.config.coverage.tempDirectory
      const { exitCode } = await execa(process.argv0, process.argv.slice(1), { stdio: 'inherit' })
      process.exit(exitCode)
    }
  }

  if (ctx.config.environment && ctx.config.environment !== 'node') {
    if (!await ensurePackageInstalled(ctx.config.environment))
      process.exit(1)
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
    throw e
  }
  finally {
    if (!ctx.config.watch)
      await ctx.exit()
  }
}
