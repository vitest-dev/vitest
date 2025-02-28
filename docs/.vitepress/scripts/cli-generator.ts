import type { CLIOption, CLIOptions } from '../../../packages/vitest/src/node/cli/cli-config'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cliOptionsConfig } from '../../../packages/vitest/src/node/cli/cli-config'

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cliTablePath = resolve(docsDir, './guide/cli-generated.md')

const nonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined

const skipCli = new Set([
  'mergeReports',
  'changed',
  'shard',
])

const skipConfig = new Set([
  'config',
  'api.port',
  'api.host',
  'api.strictPort',
  'coverage.watermarks.statements',
  'coverage.watermarks.lines',
  'coverage.watermarks.branches',
  'coverage.watermarks.functions',
  'coverage.thresholds.statements',
  'coverage.thresholds.branches',
  'coverage.thresholds.functions',
  'coverage.thresholds.lines',
  'standalone',
  'clearScreen',
  'color',
  'run',
  'hideSkippedTests',
  'dom',
])

function resolveOptions(options: CLIOptions<any>, parentName?: string) {
  return Object.entries(options).flatMap(
    ([subcommandName, subcommandConfig]) => resolveCommand(
      parentName ? `${parentName}.${subcommandName}` : subcommandName,
      subcommandConfig,
    ),
  ).filter(nonNullable)
}

function resolveCommand(name: string, config: CLIOption<any> | null): any {
  if (!config || skipCli.has(name)) {
    return null
  }

  let title = '`'
  if (config.shorthand) {
    title += `-${config.shorthand}, `
  }
  title += `--${config.alias || name}`
  if ('argument' in config) {
    title += ` ${config.argument}`
  }
  title += '`'
  if ('subcommands' in config && config.subcommands) {
    return resolveOptions(config.subcommands, name)
  }

  return {
    title: name,
    cli: title,
    description: config.description,
  }
}

const options = resolveOptions(cliOptionsConfig)

const template = options.map((option) => {
  const title = option.title
  const cli = option.cli
  const config = skipConfig.has(title) ? '' : `[${title}](${title.includes('browser.') ? '/guide/browser/config' : '/config/'}#${title.toLowerCase().replace(/\./g, '-')})`
  return `### ${title}\n\n- **CLI:** ${cli}\n${config ? `- **Config:** ${config}\n` : ''}\n${option.description}\n`
}).join('\n')

writeFileSync(cliTablePath, template, 'utf-8')
