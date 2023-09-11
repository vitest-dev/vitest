import type { CancelReason } from '@vitest/runner'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { serializeError } from '@vitest/utils/error'
import type { RunnerRPC, RuntimeRPC, ShadowRealmContext, WorkerGlobalState } from '../types'
import { loadEnvironment } from '../integrations/env'
import { mockMap, moduleCache, startViteNode } from './execute'
import { createSafeRpc, rpcDone } from './rpc'
import { setupInspect } from './inspector'

interface ShadowRealmOnCallback {
  (fn: (data: string) => void): void
}

interface ShadowRealmSendCallback {
  (data: string): void
}

async function init(ctx: ShadowRealmContext, send: ShadowRealmSendCallback, on: ShadowRealmOnCallback) {
  const { config } = ctx

  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  const rpc = createBirpc<RuntimeRPC, RunnerRPC>(
    {
      onCancel: setCancel,
    },
    {
      eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit', 'onCancel'],
      post(v) { send(v) },
      on(fn) {
        on((data: any) => {
          fn(data)
        })
      },
      serialize: stringify,
      deserialize: parse,
    },
  )

  const environment = await loadEnvironment(ctx.environment.name, ctx.config.root)
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
    rpc: createSafeRpc(rpc),
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

export function run(
  ctxString: string,
  send: ShadowRealmSendCallback,
  on: ShadowRealmOnCallback,
  done: () => void,
  error: (err: string) => void,
) {
  (async () => {
    const ctx = parse(ctxString) as ShadowRealmContext
    const inspectorCleanup = setupInspect(ctx.config)

    try {
      const state = await init(ctx, send, on)
      const { run, executor } = await startViteNode({ state })
      await run(ctx.files, ctx.config, { environment: state.environment, options: ctx.environment.options }, executor)
      await rpcDone()
    }
    catch (err: any) {
      error(stringify(serializeError(err)))
    }
    finally {
      inspectorCleanup()
      done()
    }
  })()
}
