import { createCLI } from './cac'

const cli = createCLI()

try {
  cli.parse()
}
catch (originalError) {
  // CAC may fail to parse arguments when boolean flags and dot notation are mixed
  // e.g. "--coverage --coverage.reporter text" will fail, when "--coverage.enabled --coverage.reporter text" will pass
  const fullArguments = cli.rawArgs.join(' ')
  const conflictingArgs: { arg: string; dotArgs: string[] }[] = []

  for (const arg of cli.rawArgs) {
    if (arg.startsWith('--') && !arg.includes('.') && fullArguments.includes(`${arg}.`)) {
      const dotArgs = cli.rawArgs.filter(rawArg => rawArg.startsWith(arg) && rawArg.includes('.'))
      conflictingArgs.push({ arg, dotArgs })
    }
  }

  if (conflictingArgs.length === 0)
    throw originalError

  const error = conflictingArgs
    .map(({ arg, dotArgs }) =>
      `A boolean argument "${arg}" was used with dot notation arguments "${dotArgs.join(' ')}".`
      + `\nPlease specify the "${arg}" argument with dot notation as well: "${arg}.enabled"`)
    .join('\n')

  throw new Error(error)
}
