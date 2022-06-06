import cac from 'cac'
import c from 'picocolors'
import { version } from '../../package.json'
import type { CliOptions } from './cli-api'
import { startVitest } from './cli-api'
import { divider } from './reporters/renderers/utils'

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'root path')
  .option('-c, --config <path>', 'path to config file')
  .option('-u, --update', 'update snapshot')
  .option('-w, --watch', 'watch mode')
  .option('-t, --testNamePattern <pattern>', 'run tests with full names matching the specified pattern')
  .option('--dir <path>', 'base directory to scan for the test files')
  .option('--ui', 'enable UI')
  .option('--open', 'open UI automatically (default: !process.env.CI))')
  .option('--api [api]', 'serve API, available options: --api.port <port>, --api.host [host] and --api.strictPort')
  .option('--threads', 'enabled threads (default: true)')
  .option('--silent', 'silent console output from tests')
  .option('--isolate', 'isolate environment for each test file (default: true)')
  .option('--reporter <name>', 'reporter')
  .option('--outputTruncateLength <length>', 'diff output length (default: 80)')
  .option('--outputFile <filename/-s>', 'write test results to a file when the --reporter=json or --reporter=junit option is also specified, use cac\'s dot notation for individual outputs of mutliple reporters')
  .option('--coverage', 'use c8 for coverage')
  .option('--run', 'do not watch')
  .option('--mode <name>', 'override Vite mode (default: test)')
  .option('--globals', 'inject apis globally')
  .option('--dom', 'mock browser api with happy-dom')
  .option('--environment <env>', 'runner environment (default: node)')
  .option('--passWithNoTests', 'pass when no tests found')
  .option('--allowOnly', 'Allow tests and suites that are marked as only (default: !process.env.CI)')
  .option('--changed [since]', 'Run tests that are affected by the changed files (default: false)')
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
  try {
    if (await startVitest(cliFilters, options) === false)
      process.exit()
  }
  catch (e) {
    process.exitCode = 1
    console.error(`\n${c.red(divider(c.bold(c.inverse(' Unhandled Error '))))}`)
    console.error(e)
    console.error('\n\n')
  }
}
