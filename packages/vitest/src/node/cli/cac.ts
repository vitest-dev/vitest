import type { VitestRunMode } from '../types/config'
import type { CliOptions } from './cli-api'
import type { CLIOption, CLIOptions as CLIOptionsConfig } from './cli-config'
import { toArray } from '@vitest/utils'
import cac, { type CAC, type Command } from 'cac'
import { normalize } from 'pathe'
import c from 'tinyrainbow'
import { version } from '../../../package.json' with { type: 'json' }
import { benchCliOptionsConfig, cliOptionsConfig, collectCliOptionsConfig } from './cli-config'

function addCommand(cli: CAC | Command, name: string, option: CLIOption<any>) {
  const commandName = option.alias || name
  let command = option.shorthand ? `-${option.shorthand}, --${commandName}` : `--${commandName}`
  if ('argument' in option) {
    command += ` ${option.argument}`
  }

  function transform(value: unknown) {
    if (!option.array && Array.isArray(value)) {
      const received = value.map(s => typeof s === 'string' ? `"${s}"` : s).join(', ')
      throw new Error(
        `Expected a single value for option "${command}", received [${received}]`,
      )
    }
    if (option.transform) {
      return option.transform(value)
    }
    if (option.array) {
      return toArray(value)
    }
    if (option.normalize) {
      return normalize(String(value))
    }
    return value
  }

  const hasSubcommands = 'subcommands' in option && option.subcommands

  if (option.description) {
    let description = option.description.replace(/\[.*\]\((.*)\)/, '$1').replace(/`/g, '')

    if (hasSubcommands) {
      description += `. Use '--help --${commandName}' for more info.`
    }

    cli.option(command, description, {
      type: transform,
    })
  }

  if (hasSubcommands) {
    for (const commandName in option.subcommands) {
      const subcommand = option.subcommands[commandName]
      if (subcommand) {
        addCommand(cli, `${name}.${commandName}`, subcommand)
      }
    }
  }
}

export interface CliParseOptions {
  allowUnknownOptions?: boolean
}

function addCliOptions(cli: CAC | Command, options: CLIOptionsConfig<any>) {
  for (const [optionName, option] of Object.entries(options)) {
    if (option) {
      addCommand(cli, optionName, option)
    }
  }
}

export function createCLI(options: CliParseOptions = {}) {
  const cli = cac('vitest')

  cli.version(version)

  addCliOptions(cli, cliOptionsConfig)

  cli.help((info) => {
    const helpSection = info.find(current => current.title?.startsWith('For more info, run any command'))

    if (helpSection) {
      helpSection.body += '\n  $ vitest --help --expand-help'
    }

    const options = info.find(current => current.title === 'Options')

    if (typeof options !== 'object') {
      return info
    }

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

    if (subcommands.length === 1 && (subcommands[0] === '--expand-help' || subcommands[0] === '--expandHelp')) {
      return info
    }

    const subcommandMarker = '$SUB_COMMAND_MARKER$'

    const banner = info.find(current => /^vitest\/\d+\.\d+\.\d+$/.test(current.body))
    function addBannerWarning(warning: string) {
      if (typeof banner?.body === 'string') {
        if (banner?.body.includes(warning)) {
          return
        }

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
    .command('run [...filters]', undefined, options)
    .action(run)

  cli
    .command('related [...filters]', undefined, options)
    .action(runRelated)

  cli
    .command('watch [...filters]', undefined, options)
    .action(watch)

  cli
    .command('dev [...filters]', undefined, options)
    .action(watch)

  addCliOptions(
    cli
      .command('bench [...filters]', undefined, options)
      .action(benchmark),
    benchCliOptionsConfig,
  )

  cli
    .command('init <project>', undefined, options)
    .action(init)

  addCliOptions(
    cli
      .command('list [...filters]', undefined, options)
      .action((filters, options) => collect('test', filters, options)),
    collectCliOptionsConfig,
  )

  cli
    .command('[...filters]', undefined, options)
    .action((filters, options) => start('test', filters, options))

  return cli
}

export function parseCLI(argv: string | string[], config: CliParseOptions = {}): {
  filter: string[]
  options: CliOptions
} {
  const arrayArgs = typeof argv === 'string' ? argv.split(' ') : argv
  if (arrayArgs[0] !== 'vitest') {
    throw new Error(`Expected "vitest" as the first argument, received "${arrayArgs[0]}"`)
  }
  arrayArgs[0] = '/index.js'
  arrayArgs.unshift('node')
  let { args, options } = createCLI(config).parse(arrayArgs, {
    run: false,
  })
  if (arrayArgs[2] === 'watch' || arrayArgs[2] === 'dev') {
    options.watch = true
  }
  if (arrayArgs[2] === 'run') {
    options.run = true
  }
  if (arrayArgs[2] === 'related') {
    options.related = args
    options.passWithNoTests ??= true
    args = []
  }
  return {
    filter: args as string[],
    options,
  }
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

function normalizeCliOptions(cliFilters: string[], argv: CliOptions): CliOptions {
  if (argv.exclude) {
    argv.cliExclude = toArray(argv.exclude)
    delete argv.exclude
  }
  if (cliFilters.some(filter => filter.includes(':'))) {
    argv.includeTaskLocation ??= true
  }

  // running "vitest --browser.headless"
  if (typeof argv.browser === 'object' && !('enabled' in argv.browser)) {
    argv.browser.enabled = true
  }
  if (typeof argv.typecheck?.only === 'boolean') {
    argv.typecheck.enabled ??= true
  }

  return argv
}

async function start(mode: VitestRunMode, cliFilters: string[], options: CliOptions): Promise<void> {
  try {
    process.title = 'node (vitest)'
  }
  catch {}

  try {
    const { startVitest } = await import('./cli-api')
    const ctx = await startVitest(mode, cliFilters.map(normalize), normalizeCliOptions(cliFilters, options))
    if (!ctx.shouldKeepServer()) {
      await ctx.exit()
    }
  }
  catch (e) {
    const { divider } = await import('../reporters/renderers/utils')
    console.error(`\n${c.red(divider(c.bold(c.inverse(' Startup Error '))))}`)
    console.error(e)
    console.error('\n\n')

    if (process.exitCode == null) {
      process.exitCode = 1
    }

    process.exit()
  }
}

async function init(project: string) {
  if (project !== 'browser') {
    console.error(new Error('Only the "browser" project is supported. Use "vitest init browser" to create a new project.'))
    process.exit(1)
  }

  const { create } = await import('../../create/browser/creator')
  await create()
}

async function collect(mode: VitestRunMode, cliFilters: string[], options: CliOptions): Promise<void> {
  try {
    process.title = 'node (vitest)'
  }
  catch {}

  try {
    const { prepareVitest, processCollected, outputFileList } = await import('./cli-api')
    const ctx = await prepareVitest(mode, {
      ...normalizeCliOptions(cliFilters, options),
      watch: false,
      run: true,
    })
    if (!options.filesOnly) {
      const { testModules: tests, unhandledErrors: errors } = await ctx.collect(cliFilters.map(normalize))

      if (errors.length) {
        console.error('\nThere were unhandled errors during test collection')
        errors.forEach(e => console.error(e))
        console.error('\n\n')
        await ctx.close()
        return
      }

      processCollected(ctx, tests, options)
    }
    else {
      const files = await ctx.getRelevantTestSpecifications(cliFilters.map(normalize))
      outputFileList(files, options)
    }

    await ctx.close()
  }
  catch (e) {
    const { divider } = await import('../reporters/renderers/utils')
    console.error(`\n${c.red(divider(c.bold(c.inverse(' Collect Error '))))}`)
    console.error(e)
    console.error('\n\n')

    if (process.exitCode == null) {
      process.exitCode = 1
    }

    process.exit()
  }
}
