import type { FileSpecification } from '@vitest/runner'
import type { TinypoolWorkerMessage } from 'tinypool'
import type { ResolvedConfig, SerializedConfig } from '../../node/types/config'
import type { WorkerContext } from '../../node/types/worker'
import type { WorkerRpcOptions } from './types'
import { parseRegexp } from '@vitest/utils'

const REGEXP_WRAP_PREFIX = '$$vitest:'

// Store global APIs in case process is overwritten by tests
const processSend = process.send?.bind(process)
const processOn = process.on?.bind(process)
const processOff = process.off?.bind(process)
const dispose: (() => void)[] = []

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

export function disposeInternalListeners(): void {
  for (const fn of dispose) {
    try {
      fn()
    }
    catch {}
  }
  dispose.length = 0
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
      const handler = (message: any, ...extras: any) => {
        // Do not react on Tinypool's internal messaging
        if ((message as TinypoolWorkerMessage)?.__tinypool_worker_message__) {
          return
        }

        return fn(message, ...extras)
      }
      processOn('message', handler)
      dispose.push(() => processOff('message', handler))
    },
  }
}

export function unwrapFileSpecifications(files: FileSpecification[] | string[]): FileSpecification[] | string[] {
  return files.map((spec) => {
    if (typeof spec === 'string') {
      return spec
    }
    const { filepath, testLocations, testNamePattern } = spec
    return ({
      filepath,
      testLocations,
      testNamePattern: testNamePattern ? unwrapRegExp(testNamePattern) : undefined,
    })
  }) as string[] | FileSpecification[]
}

function unwrapRegExp(regexp: RegExp | string): RegExp {
  if (typeof regexp === 'string' && regexp.startsWith(REGEXP_WRAP_PREFIX)) {
    return parseRegexp(
      regexp.slice(REGEXP_WRAP_PREFIX.length),
    )
  }
  return regexp as RegExp
}

/**
 * Reverts the wrapping done by `utils/config-helpers.ts`'s `wrapSerializableConfig`
 */
export function unwrapSerializableConfig(config: SerializedConfig): SerializedConfig {
  if (config.testNamePattern && typeof config.testNamePattern === 'string') {
    config.testNamePattern = unwrapRegExp(config.testNamePattern)
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
