import type { CAC, Command } from 'cac'
import type { CliOptions } from './cli-api'
import type { CLIOption, CLIOptions as CLIOptionsConfig } from './cli-config'
import { toArray } from '@vitest/utils/helpers'
import cac from 'cac'
import { normalize } from 'pathe'
import { disableDefaultColors } from 'tinyrainbow'
import { version } from '../../../package.json' with { type: 'json' }
import { isAgent, isForceColor } from '../../utils/env'
import { cliOptionsConfig, collectCliOptionsConfig } from './cli-config'
import { setupTabCompletions } from './completions'

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
    value = removeQuotes(value)
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

const reporterOptionValuePrefix = '__VITEST_REPORTER_OPTION_VALUE__:'
const forbiddenReporterOptionKeys = new Set(['__proto__', 'constructor', 'prototype'])

function prepareCLIArguments(argv: readonly string[]): {
  args: string[]
  reporterOptionNames: Map<string, string>
} {
  const args = [...argv]
  const prefixes = ['--reporterOption.', '--reporter-option.']
  const reporterOptionNames = new Map<string, string>()
  const reporterOptionPlaceholders = new Map<string, string>()

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--') {
      break
    }
    const prefix = prefixes.find(prefix => argument.startsWith(prefix))
    if (!prefix) {
      continue
    }

    const separator = argument.indexOf('=')
    let key = argument.slice(prefix.length, separator === -1 ? undefined : separator)
    if (key.startsWith('[')) {
      const closingBracket = key.indexOf('].')
      if (closingBracket <= 1) {
        throw new Error('Reporter options must use --reporterOption.<reporter>.<option>=<value>')
      }
      const reporterName = key.slice(1, closingBracket)
      const optionName = key.slice(closingBracket + 2)
      let placeholder = reporterOptionPlaceholders.get(reporterName)
      if (!placeholder) {
        placeholder = `__VITEST_REPORTER_OPTION_${reporterOptionPlaceholders.size}__`
        reporterOptionPlaceholders.set(reporterName, placeholder)
        reporterOptionNames.set(placeholder, reporterName)
      }
      key = `${placeholder}.${optionName}`
    }

    const keys = key.split('.')
    if (keys.length < 2 || keys.some(key => key.length === 0)) {
      throw new Error('Reporter options must use --reporterOption.<reporter>.<option>=<value>')
    }
    for (const key of keys) {
      if (
        forbiddenReporterOptionKeys.has(key)
        || Object.hasOwn(Object.prototype, key)
      ) {
        throw new Error(`Reporter option keys cannot include "${key}"`)
      }
    }

    if (separator !== -1) {
      args[index] = `${prefix}${key}=${reporterOptionValuePrefix}${argument.slice(separator + 1)}`
      continue
    }

    args[index] = `${prefix}${key}`

    const value = args[index + 1]
    if (value == null || value.startsWith('-')) {
      throw new Error(`Expected a value for option "${argument}"`)
    }
    args[index + 1] = `${reporterOptionValuePrefix}${value}`
    index += 1
  }

  return { args, reporterOptionNames }
}

function normalizeReporterOptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return normalizeReporterOptionValue(value.at(-1))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, normalizeReporterOptionValue(value)]),
    )
  }
  if (typeof value === 'string' && value.startsWith(reporterOptionValuePrefix)) {
    const rawValue = value.slice(reporterOptionValuePrefix.length)
    if (rawValue === 'true') {
      return true
    }
    if (rawValue === 'false') {
      return false
    }
    return rawValue
  }
  return value
}

function normalizeReporterOptions(
  argv: CliOptions,
  reporterOptionNames: Map<string, string>,
): CliOptions {
  if (argv.reporterOption) {
    const reporterOptions = normalizeReporterOptionValue(argv.reporterOption) as NonNullable<CliOptions['reporterOption']>
    argv.reporterOption = Object.fromEntries(
      Object.entries(reporterOptions).map(([key, value]) => [
        reporterOptionNames.get(key) || key,
        value,
      ]),
    )
  }
  return argv
}

function addCliOptions(cli: CAC | Command, options: CLIOptionsConfig<any>) {
  for (const [optionName, option] of Object.entries(options)) {
    if (option) {
      addCommand(cli, optionName, option)
    }
  }
}

export function createCLI(options: CliParseOptions = {}): CAC {
  if (isAgent && !isForceColor()) {
    disableDefaultColors()
  }

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

  cli
    .command('bench [...filters]', undefined, options)
    .action(benchmark)

  cli
    .command('init <project>', undefined, options)
    .action(init)

  addCliOptions(
    cli
      .command('list [...filters]', undefined, options)
      .action((filters, options) => collect(filters, options)),
    collectCliOptionsConfig,
  )

  cli
    .command('[...filters]', undefined, options)
    .action((filters, options) => start(filters, options))

  setupTabCompletions(cli)

  const internalCli = cli as unknown as {
    mri: (argv: string[], command?: Command) => { args: string[]; options: CliOptions }
  }
  const parseArguments = internalCli.mri.bind(internalCli)
  internalCli.mri = (argv, command) => {
    const prepared = prepareCLIArguments(argv)
    const parsed = parseArguments(prepared.args, command)
    parsed.options = normalizeReporterOptions(parsed.options, prepared.reporterOptionNames)
    return parsed
  }

  return cli
}

function removeQuotes<T>(str: T): T {
  if (typeof str !== 'string') {
    if (Array.isArray(str)) {
      return str.map(removeQuotes) as unknown as T
    }
    return str
  }
  if (str[0] === '"' && str.endsWith('"')) {
    return str.slice(1, -1) as unknown as T
  }
  if (str.startsWith(`'`) && str.endsWith(`'`)) {
    return str.slice(1, -1) as unknown as T
  }
  return str
}

function splitArgv(argv: string): string[] {
  const reg = /(['"])(?:(?!\1).)+\1/g
  argv = argv.replace(reg, match => match.replace(/\s/g, '\x00'))
  return argv.split(' ').map((arg: string) => {
    arg = arg.replace(/\0/g, ' ')
    return removeQuotes(arg)
  })
}

export function parseCLI(argv: string | string[], config: CliParseOptions = {}): {
  filter: string[]
  options: CliOptions
} {
  const arrayArgs = typeof argv === 'string' ? splitArgv(argv) : argv
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
  if (arrayArgs[2] === 'run' && !options.watch) {
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
  await start([], argv)
}

async function watch(cliFilters: string[], options: CliOptions): Promise<void> {
  options.watch = true
  await start(cliFilters, options)
}

async function run(cliFilters: string[], options: CliOptions): Promise<void> {
  // "vitest run --watch" should still be watch mode
  options.run = !options.watch

  await start(cliFilters, options)
}

async function benchmark(cliFilters: string[], options: CliOptions): Promise<void> {
  options.benchmarkOnly = true
  options.coverage ??= {}
  options.coverage.enabled = false
  await start(cliFilters, options)
}

function normalizeCliOptions(cliFilters: string[], argv: CliOptions): CliOptions {
  if (argv.exclude) {
    argv.cliExclude = toArray(argv.exclude)
    delete argv.exclude
  }
  if (cliFilters.some(filter => filter.includes(':'))) {
    argv.includeTaskLocation ??= true
  }

  if (typeof argv.typecheck?.only === 'boolean') {
    argv.typecheck.enabled ??= true
  }
  if (argv.clearCache || argv.listTags) {
    argv.watch = false
    argv.run = true
  }

  return argv
}

async function start(cliFilters: string[], options: CliOptions): Promise<void> {
  try {
    const { startVitest } = await import('./cli-api')
    const ctx = await startVitest(cliFilters.map(normalize), normalizeCliOptions(cliFilters, options))
    if (!ctx.shouldKeepServer()) {
      await ctx.exit()
    }
  }
  catch (e) {
    const { errorBanner } = await import('../reporters/renderers/utils')
    console.error(`\n${errorBanner('Startup Error')}`)
    console.error(e)
    console.error('\n\n')

    process.exitCode ??= 1

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

async function collect(cliFilters: string[], options: CliOptions): Promise<void> {
  try {
    const { prepareVitest, processCollected, outputFileList } = await import('./cli-api')
    const ctx = await prepareVitest({
      ...normalizeCliOptions(cliFilters, options),
      watch: false,
      run: true,
    }, undefined, undefined, cliFilters)
    if (!options.filesOnly) {
      const { testModules: tests, unhandledErrors: errors } = await ctx.collect(
        cliFilters.map(normalize),
        {
          staticParse: options.staticParse,
          staticParseConcurrency: options.staticParseConcurrency,
        },
      )

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
    const { errorBanner } = await import('../reporters/renderers/utils')
    console.error(`\n${errorBanner('Collect Error')}`)
    console.error(e)
    console.error('\n\n')

    process.exitCode ??= 1

    process.exit()
  }
}
