import type { TinypoolWorkerMessage } from 'tinypool'
import { parseRegexp } from '@vitest/utils'
import type { WorkerContext } from '../../types/worker'
import type { ResolvedConfig } from '../../types/config'
import type { WorkerRpcOptions } from './types'

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

function parsePossibleRegexp(str: string | RegExp) {
  const prefix = '$$vitest:'
  if (typeof str === 'string' && str.startsWith(prefix))
    return parseRegexp(str.slice(prefix.length))
  return str
}

export function unwrapForksConfig(config: ResolvedConfig) {
  if (config.testNamePattern)
    config.testNamePattern = parsePossibleRegexp(config.testNamePattern) as RegExp
  return config
}
