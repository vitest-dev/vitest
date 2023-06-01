import v8 from 'node:v8'
import { createBirpc } from 'birpc'
import { parseRegexp } from '@vitest/utils'
import type { CancelReason } from '@vitest/runner'
import type { ResolvedConfig } from '../types'
import type { RunnerRPC, RuntimeRPC } from '../types/rpc'
import type { ChildContext } from '../types/child'
import { mockMap, moduleCache, startViteNode } from './execute'
import { rpcDone } from './rpc'
import { setupInspect } from './inspector'

function init(ctx: ChildContext) {
  const { config, environment } = ctx

  process.env.VITEST_WORKER_ID = '1'
  process.env.VITEST_POOL_ID = '1'

  let setCancel = (_reason: CancelReason) => {}
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve
  })

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = environment.name
  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    mockMap,
    onCancel,
    durations: {
      environment: 0,
      prepare: performance.now(),
    },
    rpc: createBirpc<RuntimeRPC, RunnerRPC>(
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
        on(fn) { process.on('message', fn) },
      },
    ),
  }

  if (ctx.invalidates) {
    ctx.invalidates.forEach((fsPath) => {
      moduleCache.delete(fsPath)
      moduleCache.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach(i => moduleCache.delete(i))
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
  const inspectorCleanup = setupInspect(ctx.config)

  try {
    init(ctx)
    const { run, executor, environment } = await startViteNode(ctx)
    await run(ctx.files, ctx.config, { ...ctx.environment, environment }, executor)
    await rpcDone()
  }
  finally {
    inspectorCleanup()
  }
}

const procesExit = process.exit

process.on('message', async (message: any) => {
  if (typeof message === 'object' && message.command === 'start') {
    try {
      message.config = unwrapConfig(message.config)
      await run(message)
    }
    finally {
      procesExit()
    }
  }
})
