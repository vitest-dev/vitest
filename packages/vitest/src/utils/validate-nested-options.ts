import type { CliOptions } from '../node/cli/cli-api'
import type { CLIOptions as CLIOptionsConfig } from '../node/cli/cli-config'

function throwUnknownOptionError(path: string, key: string, validSubcommands: Set<string>): never {
  const validOptionsList = Array.from(validSubcommands).map(opt => `"${path}.${opt}"`).join(', ')
  const suggestions = validOptionsList || 'none'
  throw new Error(
    `Unknown option "${path}.${key}". `
    + `Did you mean one of: ${suggestions}? `
    + `Use '--help --${path.split('.')[0]}' for more info.`,
  )
}

function validateOptionValue(
  value: any,
  key: string,
  subcommandConfig: any,
  currentPath: string,
): void {
  if (subcommandConfig && 'subcommands' in subcommandConfig && subcommandConfig.subcommands) {
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      const nestedPath = `${currentPath}.${key}`
      validateNestedOptions(value as CliOptions, subcommandConfig.subcommands!, nestedPath)
    }
  }
}

function validateOptionsAgainstConfig(
  options: CliOptions,
  config: CLIOptionsConfig<any>,
  path: string,
): void {
  const validSubcommands = new Set(Object.keys(config))

  for (const key in options) {
    if (!validSubcommands.has(key)) {
      throwUnknownOptionError(path, key, validSubcommands)
    }

    const subcommandConfig = config[key]
    const optionValue = (options as any)[key]
    validateOptionValue(optionValue, key, subcommandConfig, path)
  }
}

export function validateNestedOptions(options: CliOptions, config: CLIOptionsConfig<any>, path: string = ''): void {
  // If path is provided, we're in a recursive call and should validate all keys in options
  // against the config. Otherwise, iterate over config entries to find nested options.
  if (path) {
    // Recursive case: validate all keys in options against config
    validateOptionsAgainstConfig(options, config, path)
  }
  else {
    // Top-level case: iterate over config entries to find nested options
    for (const [optionName, option] of Object.entries(config)) {
      if (!option) {
        continue
      }

      const hasSubcommands = 'subcommands' in option && option.subcommands
      if (!hasSubcommands) {
        continue
      }

      const optionValue = (options as any)[optionName]
      if (optionValue == null || typeof optionValue !== 'object' || Array.isArray(optionValue)) {
        continue
      }

      validateOptionsAgainstConfig(optionValue as CliOptions, option.subcommands!, optionName)
    }
  }
}
