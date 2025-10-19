import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { VitestWorker } from './types'
import { serializeError } from '@vitest/utils/error'
import * as entrypoint from '../worker'

interface Options {
  send: (response: WorkerResponse) => void
  subscribe: (callback: (message: WorkerRequest) => Promise<void>) => void
  off: (callback: Parameters<Options['subscribe']>[0]) => void
  worker: VitestWorker
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

/** @experimental */
export function init({ send, subscribe, off, worker }: Options): void {
  subscribe(onMessage)

  let runPromise: Promise<unknown> | undefined

  async function onMessage(message: WorkerRequest) {
    if (message?.__vitest_worker_request__ !== true) {
      return
    }

    switch (message.type) {
      case 'start': {
        reportMemory = message.options.reportMemory

        send({ type: 'started', __vitest_worker_response__ })

        break
      }

      case 'run': {
        process.env.VITEST_POOL_ID = String(message.poolId)
        process.env.VITEST_WORKER_ID = String(message.context.workerId)

        runPromise = entrypoint.run(message.context, worker)
          .catch(error => serializeError(error))
          .finally(() => (runPromise = undefined))
        const error = await runPromise

        send({
          type: 'testfileFinished',
          __vitest_worker_response__,
          error,
          usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
        })

        break
      }

      case 'collect': {
        process.env.VITEST_POOL_ID = String(message.poolId)
        process.env.VITEST_WORKER_ID = String(message.context.workerId)

        runPromise = entrypoint.collect(message.context, worker)
          .catch(error => serializeError(error))
          .finally(() => (runPromise = undefined))
        const error = await runPromise

        send({
          type: 'testfileFinished',
          __vitest_worker_response__,
          error,
          usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
        })

        break
      }

      case 'stop': {
        await runPromise
        const error = await entrypoint.teardown()
          .catch(error => serializeError(error))

        send({ type: 'stopped', error, __vitest_worker_response__ })
        off(onMessage)

        break
      }
    }
  }
}

export function createDisposer(): {
  on: (callback: () => void) => void
  clear: () => void
} {
  const callbacks: (() => void)[] = []

  function on(callback: () => void): void {
    callbacks.push(callback)
  }

  function clear(): void {
    for (const fn of callbacks) {
      try {
        fn()
      }
      catch {}
    }
    callbacks.length = 0
  }

  return { on, clear }
}
