import type { Plugin } from 'vite'
import type { ViteNodeRunner } from 'vite-node/client'
import c from 'picocolors'
import { toArray } from '../../utils'
import { divider } from '../reporters/renderers/utils'
import type { Vitest } from '../core'
import type { Logger } from '../logger'

interface GlobalSetupFile {
  file: string
  setup?: () => Promise<Function | void> | void
  teardown?: Function
}

type SetupInstance = Pick<Vitest, 'runner' | 'server'>

async function loadGlobalSetupFiles(project: SetupInstance): Promise<GlobalSetupFile[]> {
  const server = project.server
  const runner = project.runner
  const globalSetupFiles = toArray(server.config.test?.globalSetup)
  return Promise.all(globalSetupFiles.map(file => loadGlobalSetupFile(file, runner)))
}

async function loadGlobalSetupFile(file: string, runner: ViteNodeRunner): Promise<GlobalSetupFile> {
  const m = await runner.executeFile(file)
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

export function GlobalSetupPlugin(project: SetupInstance, logger: Logger): Plugin {
  let globalSetupFiles: GlobalSetupFile[]
  return {
    name: 'vitest:global-setup-plugin',
    enforce: 'pre',

    async buildStart() {
      if (!project.server.config.test?.globalSetup)
        return

      globalSetupFiles = await loadGlobalSetupFiles(project)

      try {
        for (const globalSetupFile of globalSetupFiles) {
          const teardown = await globalSetupFile.setup?.()
          if (teardown == null || !!globalSetupFile.teardown)
            continue
          if (typeof teardown !== 'function')
            throw new Error(`invalid return value in globalSetup file ${globalSetupFile.file}. Must return a function`)
          globalSetupFile.teardown = teardown
        }
      }
      catch (e) {
        logger.error(`\n${c.red(divider(c.bold(c.inverse(' Error during global setup '))))}`)
        await logger.printError(e)
        process.exit(1)
      }
    },

    async buildEnd() {
      if (globalSetupFiles?.length) {
        for (const globalSetupFile of globalSetupFiles.reverse()) {
          try {
            await globalSetupFile.teardown?.()
          }
          catch (error) {
            logger.error(`error during global teardown of ${globalSetupFile.file}`, error)
          }
        }
      }
    },
  }
}
