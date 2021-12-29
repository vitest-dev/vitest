import readline from 'readline'
import cac from 'cac'
import { execa } from 'execa'
import type { UserConfig } from '../types'
import { version } from '../../package.json'
import { ensurePackageInstalled } from '../utils'
import type { Vitest } from './index'
import { createVitest } from './index'

const CLOSE_TIMEOUT = 1_000

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'root path')
  .option('-c, --config <path>', 'path to config file')
  .option('-u, --update', 'update snapshot')
  .option('-w, --watch', 'watch mode')
  .option('-o, --open', 'open UI', { default: false })
  .option('-t, --testNamePattern <pattern>', 'run test names with the specified pattern')
  .option('--api', 'listen to port and serve API')
  .option('--threads', 'enabled threads', { default: true })
  .option('--silent', 'silent console output from tests')
  .option('--reporter <name>', 'reporter')
  .option('--coverage', 'use c8 for coverage')
  .option('--run', 'do not watch')
  .option('--global', 'inject apis globally')
  .option('--dom', 'mock browser api with happy-dom')
  .option('--findRelatedTests <filepath>', 'run only tests that import specified file')
  .option('--environment <env>', 'runner environment', { default: 'node' })
  .option('--passWithNoTests', 'pass when no tests found')
  .help()

cli
  .command('run [...filters]')
  .action(run)

cli
  .command('watch [...filters]')
  .action(dev)

cli
  .command('dev [...filters]')
  .action(dev)

cli
  .command('[...filters]')
  .action(dev)

cli.parse()

async function dev(cliFilters: string[], argv: UserConfig) {
  if (argv.watch == null)
    argv.watch = !process.env.CI && !argv.run
  await run(cliFilters, argv)
}

async function run(cliFilters: string[], options: UserConfig) {
  process.env.VITEST = 'true'
  process.env.NODE_ENV = 'test'

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
      await ctx.close()
  }

  if (!ctx.config.watch) {
    // force process exit if it hangs
    setTimeout(() => process.exit(), CLOSE_TIMEOUT).unref()
  }
}

function closeServerAndExitProcess(ctx: Vitest) {
  const closePromise = ctx.close()
  let timeout: NodeJS.Timeout
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`close timed out after ${CLOSE_TIMEOUT}ms`)), CLOSE_TIMEOUT)
  })
  Promise.race([closePromise, timeoutPromise]).then(
    () => {
      clearTimeout(timeout)
      process.exit(0)
    },
    (err) => {
      clearTimeout(timeout)
      console.error('error during close', err)
      process.exit(1)
    },
  )
}

function registerConsoleShortcuts(ctx: Vitest) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str: string, key: any) => {
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c')) { // ctrl-c or esc
      closeServerAndExitProcess(ctx)
      return
    }

    // is running, ignore keypress
    if (ctx.runningPromise)
      return

    // press any key to exit on first run
    if (ctx.isFirstRun)
      closeServerAndExitProcess(ctx)

    // TODO: add more commands
  })
}
