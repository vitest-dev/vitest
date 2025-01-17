import type { WorkerGlobalState } from '../../types/worker'
import type { ContextExecutorOptions, VitestExecutor } from '../execute'
import { resolve } from 'node:path'
import { ModuleCacheMap } from 'vite-node/client'
import { getDefaultRequestStubs, startVitestExecutor } from '../execute'
import { VitestMocker } from '../mocker'
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
  ctx.files.forEach(i => state.moduleCache.delete(
    typeof i === 'string' ? i : i.filepath,
  ))

  const [executor, { run }] = await Promise.all([
    resolveExecutor(state),
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

async function resolveExecutor(state: WorkerGlobalState): Promise<VitestExecutor> {
  if (state.config.experimentalNativeImport) {
    const executor = {
      executeId: (id: string) => import(resolve(state.config.root, id)),
      executeFile: (id: string) => import(resolve(state.config.root, id)),
      options: {
        context: undefined,
      },
    } as any // TODO: this is a hack for now, build an actual executor
    executor.mocker = new VitestMocker(executor)
    return executor
  }
  return startViteNode({ state, requestStubs: getDefaultRequestStubs() })
}
