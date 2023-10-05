import { performance } from 'node:perf_hooks'
import v8 from 'node:v8'
import { createBirpc } from 'birpc'
import { parseRegexp } from '@vitest/utils'
import { workerId as poolId } from 'tinypool'
import type { TinypoolWorkerMessage } from 'tinypool'
import type { CancelReason } from '@vitest/runner'
import type { ResolvedConfig, WorkerGlobalState } from '../types'
import type { RunnerRPC, RuntimeRPC } from '../types/rpc'
import type { ChildContext } from '../types/child'
import { loadEnvironment } from '../integrations/env'
import { mockMap, moduleCache, startViteNode } from './execute'
import { createSafeRpc, rpcDone } from './rpc'
import { setupInspect } from './inspector'

async function init(ctx: ChildContext) {
  const { config, workerId } = ctx

  process.env.VITEST_WORKER_ID = String(workerId)
  process.env.VITEST_POOL_ID = String(poolId)

  try {
    process.title = `node (vitest ${poolId})`
  }
  catch {}

  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  const rpc = createSafeRpc(createBirpc<RuntimeRPC, RunnerRPC>(
    {
      onCancel: setCancel,
    },
    {
      eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit', 'onCancel'],
      serialize: v8.serialize,
      deserialize: v => v8.deserialize(Buffer.from(v)),
      post(v) {
        process.send?.(v)
      },
      on(fn) {
        process.on('message', (message: any, ...extras: any) => {
          // Do not react on Tinypool's internal messaging
          if ((message as TinypoolWorkerMessage)?.__tinypool_worker_message__)
            return

          return fn(message, ...extras)
        })
      },
    },
  ))

  const environment = await loadEnvironment(ctx.environment.name, {
    root: ctx.config.root,
    fetchModule: id => rpc.fetch(id, 'ssr'),
    resolveId: (id, importer) => rpc.resolveId(id, importer, 'ssr'),
  })
  if (ctx.environment.transformMode)
    environment.transformMode = ctx.environment.transformMode

  const state: WorkerGlobalState = {
    ctx,
    moduleCache,
    config,
    mockMap,
    onCancel,
    environment,
    durations: {
      environment: 0,
      prepare: performance.now(),
    },
    rpc,
    isChildProcess: true,
  }

  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = state

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))

  return state
}

function parsePossibleRegexp(str: string | RegExp) {
  const prefix = '$$vitest:'
  if (typeof str === 'string' && str.startsWith(prefix))
    return parseRegexp(str.slice(prefix.length))
  return str
}

function unwrapConfig(config: ResolvedConfig) {
  if (config.testNamePattern)
    config.testNamePattern = parsePossibleRegexp(config.testNamePattern) as RegExp
  return config
}

export async function run(ctx: ChildContext) {
  const exit = process.exit

  ctx.config = unwrapConfig(ctx.config)
  const inspectorCleanup = setupInspect(ctx.config)

  try {
    const state = await init(ctx)
    const { run, executor } = await startViteNode({
      state,
    })
    await run(ctx.files, ctx.config, { environment: state.environment, options: ctx.environment.options }, executor)
    await rpcDone()
  }
  finally {
    inspectorCleanup()
    process.exit = exit
  }
}

export async function collect(ctx: ChildContext) {
  const exit = process.exit

  ctx.config = unwrapConfig(ctx.config)

  try {
    const state = await init(ctx)
    const { collect, executor } = await startViteNode({ state })
    await collect(ctx.files, ctx.config, { environment: state.environment, options: ctx.environment.options }, executor)
    await rpcDone()
  }
  finally {
    process.exit = exit
  }
}
