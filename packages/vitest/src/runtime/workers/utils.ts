import type { TinypoolWorkerMessage } from 'tinypool'
import { parseRegexp } from '@vitest/utils'
import type { WorkerContext } from '../../types/worker'
import type { ResolvedConfig } from '../../types/config'
import type { WorkerRpcOptions } from './types'

const REGEXP_WRAP_PREFIX = '$$vitest:'

// Store global APIs in case process is overwritten by tests
const processSend = process.send?.bind(process)
const processOn = process.on?.bind(process)

export function createThreadsRpcOptions({
  port,
}: WorkerContext): WorkerRpcOptions {
  return {
    post: (v) => {
      port.postMessage(v)
    },
    on: (fn) => {
      port.addListener('message', fn)
    },
  }
}

export function createForksRpcOptions(
  nodeV8: typeof import('v8'),
): WorkerRpcOptions {
  return {
    serialize: nodeV8.serialize,
    deserialize: v => nodeV8.deserialize(Buffer.from(v)),
    post(v) {
      processSend!(v)
    },
    on(fn) {
      processOn('message', (message: any, ...extras: any) => {
        // Do not react on Tinypool's internal messaging
        if ((message as TinypoolWorkerMessage)?.__tinypool_worker_message__) {
          return
        }

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

    if (testNamePattern.startsWith(REGEXP_WRAP_PREFIX)) {
      config.testNamePattern = parseRegexp(
        testNamePattern.slice(REGEXP_WRAP_PREFIX.length),
      )
    }
  }

  if (
    config.defines
    && Array.isArray(config.defines.keys)
    && config.defines.original
  ) {
    const { keys, original } = config.defines
    const defines: ResolvedConfig['defines'] = {}

    // Apply all keys from the original. Entries which had undefined value are missing from original now
    for (const key of keys) {
      defines[key] = original[key]
    }

    config.defines = defines
  }

  return config
}
