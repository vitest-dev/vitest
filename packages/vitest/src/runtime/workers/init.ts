import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { VitestWorker } from './types'
import { serializeError } from '@vitest/utils/error'
import * as entrypoint from '../worker'

interface Options extends VitestWorker {
  removeAllListeners: () => void
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

/** @experimental */
export function init(worker: Options): void {
  worker.on(onMessage)

  let runPromise: Promise<unknown> | undefined

  function send(response: WorkerResponse) {
    worker.post(worker.serialize ? worker.serialize(response) : response)
  }

  async function onMessage(rawMessage: unknown) {
    const message: WorkerRequest = worker.deserialize
      ? worker.deserialize(rawMessage)
      : rawMessage

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
        worker.removeAllListeners()

        break
      }
    }
  }
}
