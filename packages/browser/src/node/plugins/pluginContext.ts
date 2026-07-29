import type { Rollup } from 'vite'
import type { Plugin } from 'vitest/config'
import type { BrowserProvider, BrowserServerContribution } from 'vitest/node'
import type { ParentBrowserProject } from '../projectParent'
import { fileURLToPath } from 'node:url'
import { slash } from '@vitest/utils/helpers'
import { dirname, resolve } from 'pathe'

const VIRTUAL_ID_CONTEXT = '\0vitest/browser'
const ID_CONTEXT = 'vitest/browser'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function BrowserContext(contribution: BrowserServerContribution): Plugin {
  return {
    name: 'vitest:browser:virtual-module:context',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      handler(id) {
        if (id === ID_CONTEXT) {
          return VIRTUAL_ID_CONTEXT
        }
      },
    },
    load(id) {
      const globalServer = contribution.parent as ParentBrowserProject
      if (id === VIRTUAL_ID_CONTEXT) {
        return generateContextFile.call(this, globalServer)
      }
    },
  }
}

async function generateContextFile(
  this: Rollup.PluginContext,
  globalServer: ParentBrowserProject,
) {
  const commands = Object.keys(globalServer.commands)
  // The provider instance is initialized lazily when a page opens, so reading
  // `child.provider` here races and can be `undefined` before the first page is
  // opened. The provider name is uniform across a project's instances and is
  // already resolved on the config, so read it from there for this shared
  // (cached) context module. The instance is still used below for the
  // preview-only user-event import.
  const child = [...globalServer.children][0]
  const provider = child.provider
  const providerName = child.config.browser.provider?.name
  if (!providerName) {
    throw new Error(
      `Browser provider is not defined for the project "${child.project.name}". This is a bug in Vitest. Please, open a new issue with a reproduction.`,
    )
  }

  const commandsCode = commands
    .filter(command => !command.startsWith('__vitest'))
    .map((command) => {
      return `    ["${command}"]: (...args) => __vitest_browser_runner__.commands.triggerCommand("${command}", args),`
    })
    .join('\n')

  const userEventNonProviderImport = await getUserEventImport(
    provider,
    this.resolve.bind(this),
  )
  const distContextPath = slash(`/@fs/${resolve(__dirname, 'context.js')}`)

  return `
import { page, createUserEvent, cdp, locators, utils } from '${distContextPath}'
${userEventNonProviderImport}

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
export { page, cdp, locators, utils }
`
}

async function getUserEventImport(provider: BrowserProvider | undefined, resolve: (id: string, importer: string) => Promise<null | { id: string }>) {
  if (!provider || provider.name !== 'preview') {
    return 'const _userEventSetup = undefined'
  }
  const previewDistRoot = (provider as any).distRoot
  const resolved = await resolve('@testing-library/user-event', previewDistRoot)
  if (!resolved) {
    throw new Error(`Failed to resolve user-event package from ${previewDistRoot}`)
  }
  return `\
import { userEvent as _userEventSetup } from '${slash(`/@fs/${resolved.id}`)}'
`
}
