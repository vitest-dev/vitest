import { ModuleCacheMap } from 'vite-node/client'
import type { WorkerGlobalState } from '../../types/worker'
import { provideWorkerState } from '../utils'
import type { ContextExecutorOptions, VitestExecutor } from '../execute'
import { getDefaultRequestStubs, startVitestExecutor } from '../execute'

let _viteNode: VitestExecutor

const moduleCache = new ModuleCacheMap()

async function startViteNode(options: ContextExecutorOptions) {
  if (_viteNode) {
    return _viteNode
  }

  _viteNode = await startVitestExecutor(options)
  return _viteNode
}

export async function runBaseTests(method: 'run' | 'collect', state: WorkerGlobalState) {
  const { ctx } = state
  // state has new context, but we want to reuse existing ones
  state.moduleCache = moduleCache

  provideWorkerState(globalThis, state)

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => state.moduleCache.delete(i))

  const [executor, { run }] = await Promise.all([
    startViteNode({ state, requestStubs: getDefaultRequestStubs() }),
    import('../runBaseTests'),
  ])
  await run(
    method,
    ctx.files,
    ctx.config,
    { environment: state.environment, options: ctx.environment.options },
    executor,
  )
}
