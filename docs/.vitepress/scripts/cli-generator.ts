import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CLIOption, CLIOptions } from '../../../packages/vitest/src/node/cli/cli-config'
import { cliOptionsConfig } from '../../../packages/vitest/src/node/cli/cli-config'

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cliTablePath = resolve(docsDir, './guide/cli-table.md')

const nonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined

function resolveOptions(options: CLIOptions<any>, parentName?: string) {
  return Object.entries(options).flatMap(
    ([subcommandName, subcommandConfig]) => resolveCommand(
      parentName ? `${parentName}.${subcommandName}` : subcommandName,
      subcommandConfig,
    ),
  ).filter(nonNullable)
}

function resolveCommand(name: string, config: CLIOption<any> | null): any {
  if (!config) {
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
    title,
    description: config.description,
  }
}

const options = resolveOptions(cliOptionsConfig)

const template = `
| Options       |               |
| ------------- | ------------- |
${options.map(({ title, description }) => `| ${title} | ${description} |`).join('\n')}
`.trimStart()

writeFileSync(cliTablePath, template, 'utf-8')
