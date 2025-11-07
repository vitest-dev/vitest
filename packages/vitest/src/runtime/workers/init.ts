import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { WorkerSetupContext } from '../../types/worker'
import type { VitestWorker } from './types'
import { serializeError } from '@vitest/utils/error'
import { createRuntimeRpc } from '../rpc'
import * as entrypoint from '../worker'

interface Options extends VitestWorker {
  teardown?: () => void
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

/** @experimental */
export function init(worker: Options): void {
  worker.on(onMessage)

  let runPromise: Promise<unknown> | undefined
  let isRunning = false
  let workerTeardown: (() => Promise<unknown>) | undefined
  let setupContext!: WorkerSetupContext

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

        const { environment, config, pool } = message.context
        try {
          const rpc = createRuntimeRpc(worker)
          setupContext = {
            environment,
            config,
            pool,
            rpc,
            projectName: config.name || '',
          }
          workerTeardown = await worker.setup?.(setupContext)

          send({ type: 'started', __vitest_worker_response__ })
        }
        catch (error) {
          send({ type: 'started', __vitest_worker_response__, error: serializeError(error) })
        }

        break
      }

      case 'run': {
        // Prevent concurrent execution if worker is already running
        if (isRunning) {
          send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error: serializeError(new Error('[vitest-worker]: Worker is already running tests')),
          })
          return
        }

        try {
          process.env.VITEST_POOL_ID = String(message.poolId)
          process.env.VITEST_WORKER_ID = String(message.context.workerId)
        }
        catch (error) {
          return send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error: serializeError(error),
            usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
          })
        }

        isRunning = true

        try {
          runPromise = entrypoint.run({ ...setupContext, ...message.context }, worker)
            .catch(error => serializeError(error))
          const error = await runPromise

          send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error,
            usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
          })
        }
        finally {
          runPromise = undefined
          isRunning = false
        }

        break
      }

      case 'collect': {
        // Prevent concurrent execution if worker is already running
        if (isRunning) {
          send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error: serializeError(new Error('[vitest-worker]: Worker is already running tests')),
          })
          return
        }

        try {
          process.env.VITEST_POOL_ID = String(message.poolId)
          process.env.VITEST_WORKER_ID = String(message.context.workerId)
        }
        catch (error) {
          return send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error: serializeError(error),
            usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
          })
        }

        isRunning = true

        try {
          runPromise = entrypoint.collect({ ...setupContext, ...message.context }, worker)
            .catch(error => serializeError(error))
          const error = await runPromise

          send({
            type: 'testfileFinished',
            __vitest_worker_response__,
            error,
            usedMemory: reportMemory ? memoryUsage().heapUsed : undefined,
          })
        }
        finally {
          runPromise = undefined
          isRunning = false
        }

        break
      }

      case 'stop': {
        await runPromise

        try {
          const error = await entrypoint.teardown()
            .catch(error => serializeError(error))

          await workerTeardown?.()

          send({ type: 'stopped', error, __vitest_worker_response__ })
        }
        catch (error) {
          send({ type: 'stopped', error: serializeError(error), __vitest_worker_response__ })
        }

        worker.teardown?.()

        break
      }
    }
  }
}
