import { normalize } from 'pathe'
import cac from 'cac'
import c from 'picocolors'
import { version } from '../../package.json'
import type { Vitest, VitestRunMode } from '../types'
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
  .option('--outputDiffLines <lines>', 'number of diff output lines (default: 15)')
  .option('--outputFile <filename/-s>', 'write test results to a file when the --reporter=json or --reporter=junit option is also specified, use cac\'s dot notation for individual outputs of multiple reporters')
  .option('--coverage', 'enable coverage report')
  .option('--run', 'do not watch')
  .option('--mode <name>', 'override Vite mode (default: test)')
  .option('--globals', 'inject apis globally')
  .option('--dom', 'mock browser api with happy-dom')
  .option('--browser', 'run tests in browser')
  .option('--environment <env>', 'runner environment (default: node)')
  .option('--passWithNoTests', 'pass when no tests found')
  .option('--allowOnly', 'Allow tests and suites that are marked as only (default: !process.env.CI)')
  .option('--dangerouslyIgnoreUnhandledErrors', 'Ignore any unhandled errors that occur')
  .option('--shard <shard>', 'Test suite shard to execute in a format of <index>/<count>')
  .option('--changed [since]', 'Run tests that are affected by the changed files (default: false)')
  .option('--sequence <options>', 'Define in what order to run tests (use --sequence.shuffle to run tests in random order)')
  .option('--no-color', 'Removes colors from the console output')
  .option('--segfault-retry <times>', 'Return tests on segment fault (default: 0)', { default: 0 })
  .option('--inspect', 'Enable Node.js inspector')
  .option('--inspect-brk', 'Enable Node.js inspector with break')
  .help()

cli
  .command('run [...filters]')
  .action(run)

cli
  .command('related [...filters]')
  .action(runRelated)

cli
  .command('watch [...filters]')
  .action(watch)

cli
  .command('dev [...filters]')
  .action(watch)

cli
  .command('bench [...filters]')
  .action(benchmark)

cli
  .command('typecheck [...filters]')
  .action(typecheck)

cli
  .command('[...filters]')
  .action((filters, options) => start('test', filters, options))

cli.parse()

async function runRelated(relatedFiles: string[] | string, argv: CliOptions): Promise<void> {
  argv.related = relatedFiles
  argv.passWithNoTests ??= true
  await start('test', [], argv)
}

async function watch(cliFilters: string[], options: CliOptions): Promise<void> {
  options.watch = true
  await start('test', cliFilters, options)
}

async function run(cliFilters: string[], options: CliOptions): Promise<void> {
  options.run = true
  await start('test', cliFilters, options)
}

async function benchmark(cliFilters: string[], options: CliOptions): Promise<void> {
  console.warn(c.yellow('Benchmarking is an experimental feature.\nBreaking changes might not follow semver, please pin Vitest\'s version when using it.'))
  await start('benchmark', cliFilters, options)
}

async function typecheck(cliFilters: string[] = [], options: CliOptions = {}) {
  console.warn(c.yellow('Testing types with tsc and vue-tsc is an experimental feature.\nBreaking changes might not follow semver, please pin Vitest\'s version when using it.'))
  await start('typecheck', cliFilters, options)
}

function normalizeOptions(argv: CliOptions): CliOptions {
  argv.root = argv.root && normalize(argv.root)
  argv.config = argv.config && normalize(argv.config)
  argv.dir = argv.dir && normalize(argv.dir)
  return argv
}

async function start(mode: VitestRunMode, cliFilters: string[], options: CliOptions): Promise<Vitest | undefined> {
  try {
    const ctx = await startVitest(mode, cliFilters.map(normalize), normalizeOptions(options))
    if (!ctx?.config.watch)
      await ctx?.exit()
    return ctx
  }
  catch (e) {
    console.error(`\n${c.red(divider(c.bold(c.inverse(' Unhandled Error '))))}`)
    console.error(e)
    console.error('\n\n')
    process.exit(1)
  }
}
