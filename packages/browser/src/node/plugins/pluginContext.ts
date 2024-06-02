import type { Plugin } from 'vitest/config'
import type { WorkspaceProject } from 'vitest/node'
import builtinCommands from '../commands/index'

const VIRTUAL_ID_CONTEXT = '\0@vitest/browser/context'
const ID_CONTEXT = '@vitest/browser/context'

export default function BrowserContext(project: WorkspaceProject): Plugin {
  project.config.browser.commands ??= {}
  for (const [name, command] of Object.entries(builtinCommands))
    project.config.browser.commands[name] ??= command

  // validate names because they can't be used as identifiers
  for (const command in project.config.browser.commands) {
    if (!/^[a-z_$][\w$]*$/i.test(command))
      throw new Error(`Invalid command name "${command}". Only alphanumeric characters, $ and _ are allowed.`)
  }

  return {
    name: 'vitest:browser:virtual-module:context',
    enforce: 'pre',
    resolveId(id) {
      if (id === ID_CONTEXT)
        return VIRTUAL_ID_CONTEXT
    },
    load(id) {
      if (id === VIRTUAL_ID_CONTEXT)
        return generateContextFile(project)
    },
  }
}

function generateContextFile(project: WorkspaceProject) {
  const commands = Object.keys(project.config.browser.commands ?? {})
  const filepathCode = '__vitest_worker__.filepath || __vitest_worker__.current?.file?.filepath || undefined'

  const commandsCode = commands.map((command) => {
    return `    ["${command}"]: (...args) => rpc().triggerCommand("${command}", ${filepathCode}, args),`
  }).join('\n')

  return `
const rpc = () => __vitest_worker__.rpc
const channel = new BroadcastChannel('vitest')

export const server = {
  platform: ${JSON.stringify(process.platform)},
  version: ${JSON.stringify(process.version)},
  provider: ${JSON.stringify(project.browserProvider!.name)},
  browser: ${JSON.stringify(project.config.browser.name)},
  commands: {
    ${commandsCode}
  }
}
export const commands = server.commands
export const page = {
  get config() {
    return __vitest_browser_runner__.config
  },
  viewport(width, height) {
    const id = __vitest_browser_runner__.iframeId
    channel.postMessage({ type: 'viewport', width, height, id })
    // return new Promise((resolve, reject) => {
    //   channel.addEventListener('message', function handler(e) {
    //     if (e.data.type === 'viewport:done' && e.data.id === id) {
    //       channel.removeEventListener('message', handler)
    //       resolve()
    //     }
    //     if (e.data.type === 'viewport:fail' && e.data.id === id) {
    //       channel.removeEventListener('message', handler)
    //       reject(new Error(e.data.error))
    //     }
    //   })
    // })
  }
}
`
}
