import type { WorkerRequest, WorkerResponse } from '../../node/pools/types'
import type { MetaEnv, WorkerSetupContext } from '../../types/worker'
import type { FileSpecification } from '../runner/types'
import type { VitestWorker } from './types'
// default import: `flushCompileCache` only exists since Node 22.10, a named
// import would fail to link on older versions
import Module from 'node:module'
import { serializeError } from '@vitest/utils/error'
import { disableDefaultColors } from 'tinyrainbow'
import { Traces } from '../../utils/traces'
import * as listeners from '../listeners'
import { createRuntimeRpc } from '../rpc'
import * as entrypoint from '../worker'

function createImportMetaEnvProxy(): MetaEnv {
  const booleanKeys = ['DEV', 'PROD', 'SSR']
  return new Proxy(process.env, {
    get(_, key) {
      if (typeof key !== 'string') {
        return undefined
      }
      if (booleanKeys.includes(key)) {
        return !!process.env[key]
      }
      return process.env[key]
    },
    set(_, key, value) {
      if (typeof key !== 'string') {
        return true
      }
      if (booleanKeys.includes(key)) {
        process.env[key] = value ? '1' : ''
      }
      else {
        process.env[key] = value
      }
      return true
    },
  }) as MetaEnv
}

const importMetaEnvProxy = createImportMetaEnvProxy()

interface Options extends VitestWorker {
  teardown?: () => void
}

const __vitest_worker_response__ = true
const memoryUsage = process.memoryUsage.bind(process)
let reportMemory = false

// In worker threads stdio is proxied to the parent over a MessagePort with a
// backpressure protocol: a chunk stays buffered inside the worker until the
// parent acks the previous one. The pool starts `runner.stop()` as soon as it
// receives `testfileFinished`, and `thread.terminate()` halts the worker before
// buffered chunks are ever posted, losing output. An empty write's callback
// only fires after every previously buffered chunk has been acked, so awaiting
// it before signaling completion guarantees the output reached the parent.
// A cheap no-op for forks, where stdio goes through OS pipes.
function flushStdio(): Promise<unknown> {
  const flush = (stream: NodeJS.WriteStream) =>
    new Promise((resolve) => {
      try {
        stream.write('', () => resolve(undefined))
      }
      catch {
        resolve(undefined)
      }
    })
  return Promise.all([flush(process.stdout), flush(process.stderr)])
}

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
  let poolId!: number

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
        poolId = message.poolId

        if (message.context.config.disableColors) {
          disableDefaultColors()
        }

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
            metaEnv: importMetaEnvProxy,
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
            () => entrypoint.run({ ...setupContext, ...message.context, concurrencyId: poolId }, worker, traces)
              .catch(error => serializeError(error)),
          )
          const error = await runPromise

          await flushStdio()

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
            () => entrypoint.collect({ ...setupContext, ...message.context, concurrencyId: poolId }, worker, traces)
              .catch(error => serializeError(error)),
          )
          const error = await runPromise

          await flushStdio()

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

        // Persist this worker's compile cache before the parent tears the
        // worker down — forks are SIGTERM'd and never reach Node's exit-time
        // flush, so without this the cache stays write-only for them. Runs
        // even when teardown throws (the compiled modules are still worth
        // persisting). A no-op when the cache is disabled or was fully loaded
        // from disk, and cheap (~tens of ms) otherwise, so every worker can
        // afford it.
        const persistCompileCache = () => {
          try {
            Module.flushCompileCache?.()
          }
          catch {}
        }

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

          persistCompileCache()

          await flushStdio()

          send({ type: 'stopped', error, __vitest_worker_response__ })
        }
        catch (error) {
          persistCompileCache()

          await flushStdio()

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
