import type { Plugin, ViteDevServer } from 'vite'
import { toArray } from '../../utils'

interface GlobalSetupFile {
  file: string
  setup?: () => Promise<Function|void>|void
  teardown?: Function
}

async function loadGlobalSetupFiles(server: ViteDevServer): Promise<GlobalSetupFile[]> {
  const globalSetupFiles = toArray(server.config.test?.globalSetup)
  return Promise.all(globalSetupFiles.map(file => loadGlobalSetupFile(file, server)))
}

async function loadGlobalSetupFile(file: string, server: ViteDevServer): Promise<GlobalSetupFile> {
  const m = await server.ssrLoadModule(file)
  for (const exp of ['default', 'setup', 'teardown']) {
    if (m[exp] != null && typeof m[exp] !== 'function')
      throw new Error(`invalid export in globalSetup file ${file}: ${exp} must be a function`)
  }
  if (m.default) {
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
}

export const GlobalSetupPlugin = (): Plugin => {
  let server: ViteDevServer
  let globalSetupFiles: GlobalSetupFile[]
  return {
    name: 'vitest:global-setup-plugin',
    enforce: 'pre',

    // @ts-expect-error ssr is still flagged as alpha
    config(config) {
      if (config.test?.globalSetup) {
        return {
          ssr: {
            noExternal: true, // needed so ssrLoadModule call doesn't initialize server._ssrExternals
          },
        }
      }
    },

    configureServer(_server) {
      server = _server
    },

    async buildStart() {
      if (!server.config.test?.globalSetup)
        return

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
      if (globalSetupFiles?.length) {
        for (const globalSetupFile of globalSetupFiles.reverse()) {
          try {
            await globalSetupFile.teardown?.()
          }
          catch (error) {
            console.error(`error during global teardown of ${globalSetupFile.file}`, error)
          }
        }
      }
    },
  }
}
