import type { PluginContext } from 'rollup'
import type { Plugin } from 'vitest/config'
import type { ParentBrowserProject } from '../projectParent'
import { fileURLToPath } from 'node:url'
import { slash } from '@vitest/utils'
import { dirname, resolve } from 'pathe'

const VIRTUAL_ID_CONTEXT = '\0@vitest/browser/context'
const ID_CONTEXT = '@vitest/browser/context'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function BrowserContext(globalServer: ParentBrowserProject): Plugin {
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
        return generateContextFile.call(this, globalServer)
      }
    },
  }
}

async function generateContextFile(
  this: PluginContext,
  globalServer: ParentBrowserProject,
) {
  const commands = Object.keys(globalServer.commands)
  const filepathCode
    = '__vitest_worker__.filepath || __vitest_worker__.current?.file?.filepath || undefined'
  const provider = [...globalServer.children][0].provider || { name: 'preview' }
  const providerName = provider.name

  const commandsCode = commands
    .filter(command => !command.startsWith('__vitest'))
    .map((command) => {
      return `    ["${command}"]: (...args) => rpc().triggerCommand(sessionId, "${command}", filepath(), args),`
    })
    .join('\n')

  const userEventNonProviderImport = await getUserEventImport(
    providerName,
    this.resolve.bind(this),
  )
  const distContextPath = slash(`/@fs/${resolve(__dirname, 'context.js')}`)

  return `
import { page, createUserEvent, cdp } from '${distContextPath}'
${userEventNonProviderImport}
const filepath = () => ${filepathCode}
const rpc = () => __vitest_worker__.rpc
const sessionId = __vitest_browser_runner__.sessionId

export const server = {
  platform: ${JSON.stringify(process.platform)},
  version: ${JSON.stringify(process.version)},
  provider: ${JSON.stringify(providerName)},
  browser: __vitest_browser_runner__.config.browser.name,
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

async function getUserEventImport(provider: string, resolve: (id: string, importer: string) => Promise<null | { id: string }>) {
  if (provider !== 'preview') {
    return 'const _userEventSetup = undefined'
  }
  const resolved = await resolve('@testing-library/user-event', __dirname)
  if (!resolved) {
    throw new Error(`Failed to resolve user-event package from ${__dirname}`)
  }
  return `\
import { userEvent as __vitest_user_event__ } from '${slash(`/@fs/${resolved.id}`)}'
const _userEventSetup = __vitest_user_event__
`
}
