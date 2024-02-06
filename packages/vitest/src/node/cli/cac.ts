import { normalize } from 'pathe'
import cac, { type CAC } from 'cac'
import c from 'picocolors'
import { version } from '../../../package.json'
import { toArray } from '../../utils'
import type { BaseCoverageOptions, CoverageIstanbulOptions, Vitest, VitestRunMode } from '../../types'
import { divider } from '../reporters/renderers/utils'
import type { CliOptions } from './cli-api'
import { startVitest } from './cli-api'
import type { CLIOption } from './cli-config'
import { cliOptionsConfig } from './cli-config'

function addCommand(cli: CAC, name: string, option: CLIOption<any>) {
  const commandName = option.alias || name
  let command = option.shorthand ? `-${option.shorthand}, --${commandName}` : `--${commandName}`
  if ('argument' in option)
    command += ` ${option.argument}`

  function transform(value: unknown) {
    if (!option.array && Array.isArray(value))
      throw new Error(`Expected a single value for option "${command}"`)
    if (option.transform)
      return option.transform(value)
    if (option.array)
      return toArray(value)
    return value
  }

  if (option.description) {
    cli.option(command, option.description, {
      type: transform,
    })
  }

  if ('subcommands' in option && option.subcommands) {
    for (const commandName in option.subcommands) {
      const subcommand = option.subcommands[commandName]
      if (subcommand)
        addCommand(cli, `${name}.${commandName}`, subcommand)
    }
  }
}

export function createCLI() {
  const cli = cac('vitest')

  cli
    .version(version)

  for (const optionName in cliOptionsConfig) {
    const option = (cliOptionsConfig as any)[optionName] as CLIOption<any> | null
    if (option)
      addCommand(cli, optionName, option)
  }

  cli.help((info) => {
    const options = info.find(current => current.title === 'Options')
    if (typeof options !== 'object')
      return info

    const helpIndex = process.argv.findIndex(arg => arg === '--help')
    const subcommands = process.argv.slice(helpIndex + 1)

    const defaultOutput = options.body
      .split('\n')
      .filter(line => /^\s+--\S+\./.test(line) === false)
      .join('\n')

    // Filter out options with dot-notation if --help is not called with a subcommand (default behavior)
    if (subcommands.length === 0) {
      options.body = defaultOutput
      return info
    }

    if (subcommands.length === 1 && (subcommands[0] === '--expand-help' || subcommands[0] === '--expandHelp'))
      return info

    const subcommandMarker = '$SUB_COMMAND_MARKER$'

    const banner = info.find(current => /^vitest\/[0-9]+\.[0-9]+\.[0-9]+$/.test(current.body))
    function addBannerWarning(warning: string) {
      if (typeof banner?.body === 'string') {
        if (banner?.body.includes(warning))
          return

        banner.body = `${banner.body}\n WARN: ${warning}`
      }
    }

    // If other subcommand combinations are used, only show options for the subcommand
    for (let i = 0; i < subcommands.length; i++) {
      const subcommand = subcommands[i]

      // --help --expand-help can't be called with multiple subcommands and is handled above
      if (subcommand === '--expand-help' || subcommand === '--expandHelp') {
        addBannerWarning('--expand-help subcommand ignored because, when used with --help, it must be the only subcommand')
        continue
      }

      // Mark the help section for the subcommands
      if (subcommand.startsWith('--')) {
        options.body = options.body
          .split('\n')
          .map(line => (line.trim().startsWith(subcommand)) ? `${subcommandMarker}${line}` : line)
          .join('\n')
      }
    }

    // Filter based on the marked options to preserve the original sort order
    options.body = options.body
      .split('\n')
      .map(line => line.startsWith(subcommandMarker) ? line.split(subcommandMarker)[1] : '')
      .filter(line => line.length !== 0)
      .join('\n')

    if (!options.body) {
      addBannerWarning('no options were found for your subcommands so we printed the whole output')
      options.body = defaultOutput
    }

    return info
  })

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

  // TODO: remove in Vitest 2.0
  cli
    .command('typecheck [...filters]')
    .action(() => {
      throw new Error(`Running typecheck via "typecheck" command is removed. Please use "--typecheck" to run your regular tests alongside typechecking, or "--typecheck.only" to run only typecheck tests.`)
    })

  cli
    .command('[...filters]')
    .action((filters, options) => start('test', filters, options))

  return cli
}

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
  console.warn(c.yellow('Benchmarking is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest\'s version when using it.'))
  await start('benchmark', cliFilters, options)
}

function normalizeCliOptions(argv: CliOptions): CliOptions {
  if (argv.root)
    argv.root = normalize(argv.root)
  else
    delete argv.root

  if (argv.config)
    argv.config = normalize(argv.config)
  else
    delete argv.config

  if (argv.workspace)
    argv.workspace = normalize(argv.workspace)
  else
    delete argv.workspace

  if (argv.dir)
    argv.dir = normalize(argv.dir)
  else
    delete argv.dir

  if (argv.exclude) {
    argv.cliExclude = toArray(argv.exclude)
    delete argv.exclude
  }

  if (argv.coverage) {
    const coverage = argv.coverage
    if (coverage.exclude)
      coverage.exclude = toArray(coverage.exclude)

    if ((coverage as BaseCoverageOptions).include)
      (coverage as BaseCoverageOptions).include = toArray((coverage as BaseCoverageOptions).include)

    if ((coverage as CoverageIstanbulOptions).ignoreClassMethods)
      (coverage as CoverageIstanbulOptions).ignoreClassMethods = toArray((coverage as CoverageIstanbulOptions).ignoreClassMethods)
  }
  return argv
}

async function start(mode: VitestRunMode, cliFilters: string[], options: CliOptions): Promise<Vitest | undefined> {
  try {
    process.title = 'node (vitest)'
  }
  catch {}

  try {
    const ctx = await startVitest(mode, cliFilters.map(normalize), normalizeCliOptions(options))
    if (!ctx?.shouldKeepServer())
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
