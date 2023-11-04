import { ModuleCacheMap } from 'vite-node/client'
import type { ContextRPC } from '../../types/rpc'
import type { WorkerGlobalState } from '../../types/worker'
import { provideWorkerState } from '../../utils/global'
import type { ContextExecutorOptions, VitestExecutor } from '../execute'
import { startVitestExecutor } from '../execute'
import type { MockMap } from '../../types/mocker'
import type { VitestWorker, WorkerRpcOptions } from './types'

let _viteNode: VitestExecutor

const moduleCache = new ModuleCacheMap()
const mockMap: MockMap = new Map()

async function startViteNode(options: ContextExecutorOptions) {
  if (_viteNode)
    return _viteNode

  _viteNode = await startVitestExecutor(options)
  return _viteNode
}

export abstract class BaseVitestWorker implements VitestWorker {
  constructor(protected ctx: ContextRPC) {}

  getRpcOptions(): WorkerRpcOptions {
    throw new Error('Should be implemented in a subclass')
  }

  async runTests(state: WorkerGlobalState) {
    const { ctx } = state
    // state has new context, but we want to reuse existing ones
    state.moduleCache = moduleCache
    state.mockMap = mockMap

    provideWorkerState(globalThis, state)

    if (ctx.invalidates) {
      ctx.invalidates.forEach((fsPath) => {
        moduleCache.delete(fsPath)
        moduleCache.delete(`mock:${fsPath}`)
      })
    }
    ctx.files.forEach(i => state.moduleCache.delete(i))

    const [executor, { run }] = await Promise.all([
      startViteNode({ state }),
      // TODO: check the bundle before merging PR!
      import('../runScopeTests'),
    ])
    await run(
      ctx.files,
      ctx.config,
      { environment: state.environment, options: ctx.environment.options },
      executor,
    )
  }
}
