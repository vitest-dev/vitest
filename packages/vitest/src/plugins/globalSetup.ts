import type { Plugin, ViteDevServer } from 'vite'
import { toArray } from '../utils'

interface GlobalSetupFile {
  file: string
  setup?: () => Promise<Function|void>|void
  teardown?: Function
}

async function loadGlobalSetupFiles(server: ViteDevServer): Promise<GlobalSetupFile[]> {
  const globalSetupFiles = toArray(server.config.test?.globalSetup)
  return Promise.all(globalSetupFiles.map(file => loadGlobalSetupFile(file, server)))
}

function loadGlobalSetupFile(file: string, server: ViteDevServer): Promise<GlobalSetupFile> {
  return server.ssrLoadModule(file).then((m) => {
    if (m.default) {
      if (typeof m.default !== 'function')
        throw new Error(`invalid default export in globalSetup file ${file}. Must export a function`)
      return {
        file,
        setup: m.default,
      }
    }
    else if (m.setup || m.teardown) {
      return {
        file,
        setup: m.setup,
        teardown: m.teardown,
      }
    }
    else {
      throw new Error(`invalid globalSetup file ${file}. Must export setup, teardown or have a default export`)
    }
  })
}

export const GlobalSetupPlugin = (): Plugin => {
  let server: ViteDevServer
  let globalSetupFiles: GlobalSetupFile[]
  return {
    name: 'vitest:global-setup-plugin',
    enforce: 'pre',

    configureServer(_server) {
      server = _server
    },

    async buildStart() {
      globalSetupFiles = await loadGlobalSetupFiles(server)
      for (const globalSetupFile of globalSetupFiles) {
        const teardown = await globalSetupFile.setup?.()
        if (teardown == null || !!globalSetupFile.teardown)
          continue
        if (typeof teardown !== 'function')
          throw new Error(`invalid return value in globalSetup file ${globalSetupFile.file}. Must return a function`)
        globalSetupFile.teardown = teardown
      }
    },

    async buildEnd() {
      for (const globalSetupFile of globalSetupFiles.reverse()) {
        try {
          await globalSetupFile.teardown?.()
        }
        catch (error) {
          console.error(`error during global teardown of ${globalSetupFile.file}`, error)
        }
      }
    },
  }
}
