import { isatty } from 'node:tty'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import type { CancelReason } from '@vitest/runner'
import { startTests } from '@vitest/runner'
import { createColors, setupColors } from '@vitest/utils'
import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { processError } from '@vitest/utils/error'
import { setupChaiConfig } from '../integrations/chai/config'
import { startCoverageInsideWorker, stopCoverageInsideWorker } from '../integrations/coverage'
import type { RunnerRPC, RuntimeRPC, WorkerContext } from '../types'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import * as VitestIndex from '../index'
import { loadEnvironment } from '../integrations/env'
import { mockMap, moduleCache, startVitestExecutor } from './execute'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup.common'
import { withEnv } from './setup.node'
import { createSafeRpc, rpcDone } from './rpc'

interface ShadowRealmOnCallback {
  (fn: (data: string) => void): void
}

interface ShadowRealmSendCallback {
  (data: string): void
}

async function runTests(
  ctx: Omit<WorkerContext, 'port'>,
  rpc: BirpcReturn<RuntimeRPC, RunnerRPC>,
  onCancel: Promise<CancelReason>,
): Promise<void> {
  const { config, files } = ctx

  const environment = await loadEnvironment(ctx.environment.name, ctx.config.root)
  if (ctx.environment.transformMode)
    environment.transformMode = ctx.environment.transformMode

  const workerState: VitestIndex.WorkerGlobalState = {
    ctx,
    moduleCache,
    config: ctx.config,
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
  globalThis.__vitest_worker__ = workerState

  const executor = await startVitestExecutor({
    state: workerState,
  })

  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(workerState.rpc)

  setupColors(createColors(isatty(1)))

  if (workerState.environment.transformMode === 'web') {
    const _require = createRequire(import.meta.url)
    // always mock "required" `css` files, because we cannot process them
    _require.extensions['.css'] = () => ({})
    _require.extensions['.scss'] = () => ({})
    _require.extensions['.sass'] = () => ({})
    _require.extensions['.less'] = () => ({})
  }

  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig)

  const runner = await resolveTestRunner(config, executor)

  workerState.durations.prepare = performance.now() - workerState.durations.prepare

  await withEnv(environment, ctx.environment.options || config.environmentOptions || {}, async () => {
    for (const file of files) {
      workerState.filepath = file

      await startTests([file], runner)

      workerState.filepath = undefined
    }

    await stopCoverageInsideWorker(config.coverage, executor)
  })

  await rpcDone()
}

export function run(
  _ctx: string,
  send: ShadowRealmSendCallback,
  on: ShadowRealmOnCallback,
  onSuccess: () => void,
  onError: (err: string) => void,
) {
  const ctx = parse(_ctx) as Omit<WorkerContext, 'port'>

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

  runTests(
    ctx,
    rpc,
    onCancel,
  ).then(onSuccess, (err) => {
    onError(stringify(processError(err)))
  })
}
