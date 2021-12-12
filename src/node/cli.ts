/* eslint-disable no-console */
import cac from 'cac'
import c from 'picocolors'
import type { CliOptions } from '../types'
import { version } from '../../package.json'
import { DefaultReporter } from '../reporters/default'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { initViteServer } from './init'
import { start } from './run'
import { StateManager } from './state'

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'root path')
  .option('-c, --config <path>', 'path to config file')
  .option('-u, --update', 'update snapshot')
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

async function dev(cliFilters: string[], argv: CliOptions) {
  argv.watch = !process.env.CI
  await run(cliFilters, argv)
}

async function run(cliFilters: string[], argv: CliOptions) {
  process.env.VITEST = 'true'

  console.log(c.magenta(c.bold('\nVitest is in closed beta exclusively for Sponsors')))
  console.log(c.yellow('Learn more at https://vitest.dev\n'))

  const { config, server } = await initViteServer({ ...argv, cliFilters })

  const ctx = process.__vitest__ = {
    server,
    config,
    state: new StateManager(),
    snapshot: new SnapshotManager(config),
    reporter: config.reporter,
  }

  ctx.reporter = ctx.reporter || new DefaultReporter(ctx)

  try {
    await start(ctx)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    if (!config.watch)
      await server.close()
  }
}
