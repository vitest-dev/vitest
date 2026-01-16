import type { FileSpecification } from '@vitest/runner'
import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { WorkerSetupContext } from '../../types/worker'
import type { VitestWorker } from './types'
import { serializeError } from '@vitest/utils/error'
import { Traces } from '../../utils/traces'
import * as listeners from '../listeners'
import { createRuntimeRpc } from '../rpc'
import * as entrypoint from '../worker'

interface Options extends VitestWorker {
  teardown?: () => void
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

let traces!: Traces

/** @experimental */
export function init(worker: Options): void {
  worker.on(onMessage)
  if (worker.onModuleRunner) {
    listeners.onModuleRunner(worker.onModuleRunner)
  }

  let runPromise: Promise<unknown> | undefined
  let isRunning = false
  let workerTeardown: (() => Promise<unknown>) | undefined | void
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
        process.env.VITEST_POOL_ID = String(message.poolId)
        process.env.VITEST_WORKER_ID = String(message.workerId)
        reportMemory = message.options.reportMemory

        traces ??= await new Traces({
          enabled: message.traces.enabled,
          sdkPath: message.traces.sdkPath,
        }).waitInit()

        const { environment, config, pool } = message.context
        const context = traces.getContextFromCarrier(message.traces.otelCarrier)

        // record telemetry as part of "start"
        traces.recordInitSpan(context)

        try {
          const rpc = createRuntimeRpc(worker)
          setupContext = {
            environment,
            config,
            pool,
            rpc,
            projectName: config.name || '',
            traces,
          }
          workerTeardown = await traces.$(
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
          const tracesContext = traces.getContextFromCarrier(message.otelCarrier)
          runPromise = traces.$(
            'vitest.runtime.run',
            {
              context: tracesContext,
              attributes: {
                'vitest.worker.specifications': traces.isEnabled()
                  ? getFilesWithLocations(message.context.files)
                  : [],
                'vitest.worker.id': message.context.workerId,
              },
            },
            () => entrypoint.run({ ...setupContext, ...message.context }, worker, traces)
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
          const tracesContext = traces.getContextFromCarrier(message.otelCarrier)
          runPromise = traces.$(
            'vitest.runtime.collect',
            {
              context: tracesContext,
              attributes: {
                'vitest.worker.specifications': traces.isEnabled()
                  ? getFilesWithLocations(message.context.files)
                  : [],
                'vitest.worker.id': message.context.workerId,
              },
            },
            () => entrypoint.collect({ ...setupContext, ...message.context }, worker, traces)
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
          const context = traces.getContextFromCarrier(message.otelCarrier)

          const error = await traces.$(
            'vitest.runtime.teardown',
            { context },
            async () => {
              const error = await entrypoint.teardown().catch(error => serializeError(error))
              await workerTeardown?.()
              return error
            },
          )

          await traces.finish()

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

function getFilesWithLocations(files: FileSpecification[]): string[] {
  return files.flatMap((file) => {
    if (!file.testLocations) {
      return file.filepath
    }
    return file.testLocations.map((location) => {
      return `${file}:${location}`
    })
  })
}
