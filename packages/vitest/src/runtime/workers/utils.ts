import type { MessagePort } from 'node:worker_threads'
import type { TinypoolWorkerMessage } from 'tinypool'
import type { WorkerRpcOptions } from './types'

export function createThreadsRpcOptions(port: MessagePort): WorkerRpcOptions {
  return {
    post: (v) => { port.postMessage(v) },
    on: (fn) => { port.addListener('message', fn) },
  }
}

export function createForksRpcOptions(v8: typeof import('v8')): WorkerRpcOptions {
  return {
    serialize: v8.serialize,
    deserialize: v => v8.deserialize(Buffer.from(v)),
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
