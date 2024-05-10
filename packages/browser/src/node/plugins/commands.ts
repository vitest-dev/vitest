import type { Plugin } from 'vite'
import type { BrowserCommand, WorkspaceProject } from 'vitest/node'
import builtinCommands from '../commands/index'

const VIRTUAL_ID_COMMANDS = '\0@vitest/browser/commands'
const ID_COMMANDS = '@vitest/browser/commands'

export default function BrowserCommands(project: WorkspaceProject): Plugin {
  project.config.browser.commands ??= {}
  for (const [name, command] of Object.entries(builtinCommands))
    project.config.browser.commands[name] ??= command

  // validate names because they can't be used as identifiers
  for (const command in project.config.browser.commands) {
    if (!/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(command))
      throw new Error(`Invalid command name "${command}". Only alphanumeric characters, $ and _ are allowed.`)
  }

  return {
    name: 'vitest:browser:virtual-module:commands',
    resolveId(id) {
      if (id === ID_COMMANDS)
        return VIRTUAL_ID_COMMANDS
    },
    load(id) {
      if (id === VIRTUAL_ID_COMMANDS)
        return generateCommandsFile(project.config.browser.commands ?? {})
    },
  }
}

function generateCommandsFile(commandsMap: Record<string, BrowserCommand<any>>) {
  const commands = Object.keys(commandsMap)

  if (!commands.length)
    return ''

  const prepare = `
const rpc = () => __vitest_worker__.rpc
`
  const commandsCode = commands.map((command) => {
    return `export const ${command} = (...args) => rpc().triggerCommand('${command}', args)`
  })

  return `${prepare}\n${commandsCode.join('\n')}`
}
