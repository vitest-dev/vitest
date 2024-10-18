import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vitest/config'
import type { BrowserProvider } from 'vitest/node'
import { dirname, resolve } from 'pathe'
import type { PluginContext } from 'rollup'
import { slash } from '@vitest/utils'
import builtinCommands from '../commands/index'
import type { BrowserServer } from '../server'

const VIRTUAL_ID_CONTEXT = '\0@vitest/browser/context'
const ID_CONTEXT = '@vitest/browser/context'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function BrowserContext(server: BrowserServer): Plugin {
  const project = server.project
  project.config.browser.commands ??= {}
  for (const [name, command] of Object.entries(builtinCommands)) {
    project.config.browser.commands[name] ??= command
  }

  // validate names because they can't be used as identifiers
  for (const command in project.config.browser.commands) {
    if (!/^[a-z_$][\w$]*$/i.test(command)) {
      throw new Error(
        `Invalid command name "${command}". Only alphanumeric characters, $ and _ are allowed.`,
      )
    }
  }

  return {
    name: 'vitest:browser:virtual-module:context',
    enforce: 'pre',
    resolveId(id) {
      if (id === ID_CONTEXT) {
        return VIRTUAL_ID_CONTEXT
      }
    },
    load(id) {
      if (id === VIRTUAL_ID_CONTEXT) {
        return generateContextFile.call(this, server)
      }
    },
  }
}

async function generateContextFile(
  this: PluginContext,
  server: BrowserServer,
) {
  const commands = Object.keys(server.project.config.browser.commands ?? {})
  const filepathCode
    = '__vitest_worker__.filepath || __vitest_worker__.current?.file?.filepath || undefined'
  const provider = server.provider

  const commandsCode = commands
    .filter(command => !command.startsWith('__vitest'))
    .map((command) => {
      return `    ["${command}"]: (...args) => rpc().triggerCommand(contextId, "${command}", filepath(), args),`
    })
    .join('\n')

  const userEventNonProviderImport = await getUserEventImport(
    provider,
    this.resolve.bind(this),
  )
  const distContextPath = slash(`/@fs/${resolve(__dirname, 'context.js')}`)

  return `
import { page, createUserEvent, cdp } from '${distContextPath}'
${userEventNonProviderImport}
const filepath = () => ${filepathCode}
const rpc = () => __vitest_worker__.rpc
const contextId = __vitest_browser_runner__.contextId

export const server = {
  platform: ${JSON.stringify(process.platform)},
  version: ${JSON.stringify(process.version)},
  provider: ${JSON.stringify(provider.name)},
  browser: ${JSON.stringify(server.project.config.browser.name)},
  commands: {
    ${commandsCode}
  },
  config: __vitest_browser_runner__.config,
}
export const commands = server.commands
export const userEvent = createUserEvent(_userEventSetup)
export { page, cdp }
`
}

async function getUserEventImport(provider: BrowserProvider, resolve: (id: string, importer: string) => Promise<null | { id: string }>) {
  if (provider.name !== 'preview') {
    return 'const _userEventSetup = undefined'
  }
  const resolved = await resolve('@testing-library/user-event', __dirname)
  if (!resolved) {
    throw new Error(`Failed to resolve user-event package from ${__dirname}`)
  }
  return `import { userEvent as __vitest_user_event__ } from '${slash(
    `/@fs/${resolved.id}`,
  )}'\nconst _userEventSetup = __vitest_user_event__.setup()\n`
}
