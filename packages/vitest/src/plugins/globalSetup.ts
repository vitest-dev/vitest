import type { Plugin, ResolvedConfig } from 'vite'
import { toArray } from '../utils'

async function importGlobalSetupFiles(config: ResolvedConfig): Promise<GlobalSetupFile[]> {
  const root = config.root
  const globalSetup = config.test?.globalSetup
  return Promise.all(toArray(globalSetup).map(f => f.replace('<rootDir>', root)).map(importGlobalSetup))
}

interface GlobalSetupFile {
  file: string
  setup?: () => Promise<Function|void>|void
  teardown?: Function
}

function importGlobalSetup(file: string): Promise<GlobalSetupFile> {
  return import(file).then((m) => {
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
  let globalSetupFiles: GlobalSetupFile[]
  return {
    name: 'vitest:global-setup-plugin',
    enforce: 'pre',

    async configResolved(config) {
      globalSetupFiles = await importGlobalSetupFiles(config)
    },
    async buildStart() {
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
