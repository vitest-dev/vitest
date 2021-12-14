import cac from 'cac'
import c from 'picocolors'
import type { UserConfig } from '../types'
import { version } from '../../package.json'
import { createVitest } from '.'

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

async function dev(cliFilters: string[], argv: UserConfig) {
  if (argv.watch == null)
    argv.watch = !process.env.CI && !process.env.NODE_V8_COVERAGE
  await run(cliFilters, argv)
}

async function run(cliFilters: string[], options: UserConfig) {
  process.env.VITEST = 'true'
  process.env.NODE_ENV = 'test'

  if (!options.silent) {
    // eslint-disable-next-line no-console
    console.log(c.magenta(c.bold('\nVitest is in closed beta exclusively for Sponsors')))
    // eslint-disable-next-line no-console
    console.log(c.yellow('Learn more at https://vitest.dev\n'))
  }

  const ctx = await createVitest(options)

  process.__vitest__ = ctx

  try {
    await ctx.run(cliFilters)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    if (!ctx.config.watch)
      await ctx.close()
  }
}
