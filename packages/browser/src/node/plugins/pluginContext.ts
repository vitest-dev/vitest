import type { Rollup } from 'vite'
import type { Plugin } from 'vitest/config'
import type { BrowserProvider } from 'vitest/node'
import type { ParentBrowserProject } from '../projectParent'
import { fileURLToPath } from 'node:url'
import { slash } from '@vitest/utils/helpers'
import { dirname, resolve } from 'pathe'

const VIRTUAL_ID_CONTEXT = '\0vitest/browser'
const ID_CONTEXT = 'vitest/browser'
// for libraries that use an older import but are not type checked
const DEPRECATED_ID_CONTEXT = '@vitest/browser/context'

const DEPRECATED_VIRTUAL_ID_UTILS = '\0@vitest/browser/utils'
const DEPRECATED_ID_UTILS = '@vitest/browser/utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function BrowserContext(globalServer: ParentBrowserProject): Plugin {
  return {
    name: 'vitest:browser:virtual-module:context',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === ID_CONTEXT) {
        return VIRTUAL_ID_CONTEXT
      }
      if (id === DEPRECATED_ID_CONTEXT) {
        if (importer && !importer.includes('/node_modules/')) {
          globalServer.vitest.logger.deprecate(
            `${importer} tries to load a deprecated "${id}" module. `
            + `This import will stop working in the next major version. `
            + `Please, use "vitest/browser" instead.`,
          )
        }
        return VIRTUAL_ID_CONTEXT
      }
      if (id === DEPRECATED_ID_UTILS) {
        return DEPRECATED_VIRTUAL_ID_UTILS
      }
    },
    load(id) {
      if (id === VIRTUAL_ID_CONTEXT) {
        return generateContextFile.call(this, globalServer)
      }
      if (id === DEPRECATED_VIRTUAL_ID_UTILS) {
        return `
import { utils } from 'vitest/browser'
export const getElementLocatorSelectors = utils.getElementLocatorSelectors
export const debug = utils.debug
export const prettyDOM = utils.prettyDOM
export const getElementError = utils.getElementError
        `
      }
    },
  }
}

async function generateContextFile(
  this: Rollup.PluginContext,
  globalServer: ParentBrowserProject,
) {
  const commands = Object.keys(globalServer.commands)
  const provider = [...globalServer.children][0].provider
  const providerName = provider?.name || 'preview'

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
import { userEvent as __vitest_user_event__ } from '${slash(`/@fs/${resolved.id}`)}'
const _userEventSetup = __vitest_user_event__
`
}
