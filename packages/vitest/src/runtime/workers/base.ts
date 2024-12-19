import type { WorkerGlobalState } from '../../types/worker'
import type { ContextExecutorOptions, VitestExecutor } from '../execute'
import { ModuleCacheMap } from 'vite-node/client'
import { getDefaultRequestStubs, startVitestExecutor } from '../execute'
import { provideWorkerState } from '../utils'

let _viteNode: VitestExecutor

const moduleCache = new ModuleCacheMap()

async function startViteNode(options: ContextExecutorOptions) {
  if (_viteNode) {
    return _viteNode
  }

  _viteNode = await startVitestExecutor(options)
  return _viteNode
}

export async function runBaseTests(method: 'run' | 'collect', state: WorkerGlobalState, executor_?: VitestExecutor) {
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
  ctx.files.forEach(i => state.moduleCache.delete(
    typeof i === 'string' ? i : i.filepath,
  ))

  const [executor, { run }] = await Promise.all([
    executor_ || startViteNode({ state, requestStubs: getDefaultRequestStubs() }),
    import('../runBaseTests'),
  ])
  const fileSpecs = ctx.files.map(f =>
    typeof f === 'string'
      ? { filepath: f, testLocations: undefined }
      : f,
  )

  await run(
    method,
    fileSpecs,
    ctx.config,
    { environment: state.environment, options: ctx.environment.options },
    executor,
  )
}
