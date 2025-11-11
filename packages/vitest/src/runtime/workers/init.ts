import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { WorkerSetupContext } from '../../types/worker'
import type { VitestWorker } from './types'
import { serializeError } from '@vitest/utils/error'
import { Telemetry } from '../../utils/otel'
import { createRuntimeRpc } from '../rpc'
import * as entrypoint from '../worker'

interface Options extends VitestWorker {
  teardown?: () => void
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

let telemetry!: Telemetry

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

    const telemetryStart = performance.now()

    telemetry ??= await new Telemetry({
      // TODO: how to pass down options properly?
      enabled: !!process.env.VITETS_OTEL_ENABLED,
      sdkPath: process.env.VITEST_OTEL_SDK,
    }).waitInit()
    const telemetryEnd = performance.now()

    switch (message.type) {
      case 'start': {
        reportMemory = message.options.reportMemory

        const { environment, config, pool } = message.context
        const context = telemetry.getContextFromCarrier(message.otelCarrier)

        // record telemetry as part of "start"
        telemetry
          .startSpan('vitest.runtime.telemetry', { startTime: telemetryStart }, context)
          .end(telemetryEnd)

        try {
          const rpc = createRuntimeRpc(worker)
          setupContext = {
            environment,
            config,
            pool,
            rpc,
            projectName: config.name || '',
            telemetry,
          }
          workerTeardown = await telemetry.$(
            'vitest.runtime.setup',
            { context },
            () => worker.setup?.(setupContext),
          )

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
          const telemetryContext = telemetry.getContextFromCarrier(message.otelCarrier)
          runPromise = telemetry.$(
            'vitest.runtime.run',
            {
              context: telemetryContext,
              attributes: {
                // TODO: include :location
                'vitest.worker.files': message.context.files.map(f => f.filepath),
                'vitest.worker.id': message.context.workerId,
              },
            },
            () => entrypoint.run({ ...setupContext, ...message.context }, worker, telemetry)
              .catch(error => serializeError(error)),
          )
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
          const telemetryContext = telemetry.getContextFromCarrier(message.otelCarrier)
          runPromise = telemetry.$(
            'vitest.runtime.collect',
            {
              context: telemetryContext,
              attributes: {
                // TODO: include :location
                'vitest.worker.files': message.context.files.map(f => f.filepath),
                'vitest.worker.id': message.context.workerId,
              },
            },
            () => entrypoint.collect({ ...setupContext, ...message.context }, worker, telemetry)
              .catch(error => serializeError(error)),
          )
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
          const context = telemetry.getContextFromCarrier(message.otelCarrier)

          const error = await telemetry.$(
            'vitest.runtime.teardown',
            { context },
            async () => {
              const error = await entrypoint.teardown().catch(error => serializeError(error))
              await workerTeardown?.()
              return error
            },
          )

          await telemetry.finish()

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
