import type { ModuleGraph, ViteDevServer } from 'vite'
import type { Logger } from '../../../packages/vitest/src/node/logger'
import type { Vitest } from '../../../packages/vitest/src/node'
import type { StateManager } from '../../../packages/vitest/src/node/state'
import type { File, ResolvedConfig } from '../../../packages/vitest/src/types'

interface Context {
  vitest: Vitest
  output: string
}

export function getContext(): Context {
  let output = ''

  const config: Partial<ResolvedConfig> = {
    root: '/',
  }

  const moduleGraph: Partial<ModuleGraph> = {
    getModuleById: () => undefined,
  }

  const server: Partial<ViteDevServer> = {
    moduleGraph: moduleGraph as ModuleGraph,
  }

  const state: Partial<StateManager> = {
    filesMap: new Map<string, File>(),
  }

  const context: Partial<Vitest> = {
    state: state as StateManager,
    config: config as ResolvedConfig,
    server: server as ViteDevServer,
  }

  context.logger = {
    ctx: context as Vitest,
    log: (text: string) => output += `${text}\n`,
  } as unknown as Logger

  return {
    vitest: context as Vitest,
    get output() {
      return output
    },
  }
}
