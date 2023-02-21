import v8 from 'node:v8'
import { createBirpc } from 'birpc'
import { parseRegexp } from '@vitest/utils'
import type { ResolvedConfig } from '../types'
import type { RuntimeRPC } from '../types/rpc'
import type { ChildContext } from '../types/child'
import { mockMap, moduleCache, startViteNode } from './execute'
import { rpcDone } from './rpc'

function init(ctx: ChildContext) {
  const { config } = ctx

  process.env.VITEST_WORKER_ID = '1'
  process.env.VITEST_POOL_ID = '1'

  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = config.environment
  // @ts-expect-error I know what I am doing :P
  globalThis.__vitest_worker__ = {
    ctx,
    moduleCache,
    config,
    mockMap,
    rpc: createBirpc<RuntimeRPC>(
      {},
      {
        eventNames: ['onUserConsoleLog', 'onFinished', 'onCollected', 'onWorkerExit'],
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
  init(ctx)
  const { run, executor } = await startViteNode(ctx)
  await run(ctx.files, ctx.config, ctx.environment, executor)
  await rpcDone()
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
