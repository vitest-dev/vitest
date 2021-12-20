import readline from 'readline'
import cac from 'cac'
import c from 'picocolors'
import type { UserConfig } from '../types'
import { version } from '../../package.json'
import { ensurePackageInstalled } from '../utils'
import type { Vitest } from './index'
import { createVitest } from './index'

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'root path')
  .option('-c, --config <path>', 'path to config file')
  .option('-u, --update', 'update snapshot')
  .option('-w, --watch', 'watch mode')
  .option('-o, --open', 'open Vitest UI')
  .option('--api', 'listen to port and serve API')
  .option('--threads', 'enabled threads', { default: true })
  .option('--silent', 'silent')
  .option('--run', 'do not watch')
  .option('--global', 'inject apis globally')
  .option('--dom', 'mock browser api with happy-dom')
  .option('--environment <env>', 'runner environment', {
    default: 'node',
  })
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

const PROCESS_EXIT_TIMEOUT = 5_000

async function dev(cliFilters: string[], argv: UserConfig) {
  if (argv.watch == null)
    argv.watch = !process.env.CI && !process.env.NODE_V8_COVERAGE && !argv.silent && !argv.run
  await run(cliFilters, argv)
}

async function run(cliFilters: string[], options: UserConfig) {
  process.env.VITEST = 'true'
  process.env.NODE_ENV = 'test'

  const ctx = await createVitest(options)

  process.chdir(ctx.config.root)

  registerConsoleShortcuts(ctx)

  if (ctx.config.environment && ctx.config.environment !== 'node') {
    if (!await ensurePackageInstalled(ctx.config.environment))
      process.exit(1)
  }

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
    const timer = setTimeout(() => {
      console.error(c.red('Process hanging for 5 seconds after all tests are done. Exiting...'))
      process.exit(1)
    }, PROCESS_EXIT_TIMEOUT)
    timer.unref()
  }
}

function registerConsoleShortcuts(ctx: Vitest) {
  // listen to keyboard input
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on('keypress', (str: string) => {
      if (str === '\x03' || str === '\x1B') // ctrl-c or esc
        process.exit()

      // is running, ignore keypress
      if (ctx.runningPromise)
        return

      // press any key to exit on first run
      if (ctx.isFirstRun)
        process.exit()

      // TODO: add more commands
      // console.log(str, key)
    })
  }
}
