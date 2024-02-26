import type { TinypoolWorkerMessage } from 'tinypool'
import { parseRegexp } from '@vitest/utils'
import type { WorkerContext } from '../../types/worker'
import type { ResolvedConfig } from '../../types/config'
import type { WorkerRpcOptions } from './types'

const REGEXP_WRAP_PREFIX = '$$vitest:'

export function createThreadsRpcOptions({ port }: WorkerContext): WorkerRpcOptions {
  return {
    post: (v) => { port.postMessage(v) },
    on: (fn) => { port.addListener('message', fn) },
  }
}

export function createForksRpcOptions(nodeV8: typeof import('v8')): WorkerRpcOptions {
  return {
    serialize: nodeV8.serialize,
    deserialize: v => nodeV8.deserialize(Buffer.from(v)),
    post(v) { process.send!(v) },
    on(fn) {
      process.on('message', (message: any, ...extras: any) => {
        // Do not react on Tinypool's internal messaging
        if ((message as TinypoolWorkerMessage)?.__tinypool_worker_message__)
          return

        return fn(message, ...extras)
      })
    },
  }
}

/**
 * Reverts the wrapping done by `utils/config-helpers.ts`'s `wrapSerializableConfig`
 */
export function unwrapSerializableConfig(config: ResolvedConfig) {
  if (config.testNamePattern && typeof config.testNamePattern === 'string') {
    const testNamePattern = config.testNamePattern as string

    if (testNamePattern.startsWith(REGEXP_WRAP_PREFIX))
      config.testNamePattern = parseRegexp(testNamePattern.slice(REGEXP_WRAP_PREFIX.length))
  }

  return config
}
