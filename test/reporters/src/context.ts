import type { ModuleGraph, ViteDevServer } from 'vite'
import type { Vitest } from '../../../packages/vitest/src/node/core'
import type { Logger } from '../../../packages/vitest/src/node/logger'
import type { StateManager } from '../../../packages/vitest/src/node/state'
import type { ResolvedConfig } from '../../../packages/vitest/src/node/types/config'
import type { File } from '../../../packages/vitest/src/public/index'

interface Context {
  vitest: Vitest
  output: string
}

export function getContext(): Context {
  let output = ''

  const config: Partial<ResolvedConfig> = {
    root: '/vitest',
  }

  const moduleGraph: Partial<ModuleGraph> = {
    getModuleById: () => undefined,
  }

  const server: Partial<ViteDevServer> = {
    moduleGraph: moduleGraph as ModuleGraph,
  }

  const state: Partial<StateManager> = {
    filesMap: new Map<string, File[]>(),
  }

  const context: Partial<Vitest> = {
    state: state as StateManager,
    config: config as ResolvedConfig,
    server: server as ViteDevServer,
    getProjectByTaskId: () => ({ getBrowserSourceMapModuleById: () => undefined }) as any,
    getProjectByName: () => ({ getBrowserSourceMapModuleById: () => undefined }) as any,
    snapshot: {
      summary: { added: 100, _test: true },
    } as any,
  }

  // @ts-expect-error logger is readonly
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
