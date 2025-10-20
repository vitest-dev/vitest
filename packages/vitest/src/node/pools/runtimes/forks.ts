import type { ChildProcess } from 'node:child_process'
import type { SerializedConfig } from '../../types/config'
import type { PoolRuntime, WorkerRequest } from '../types'
import { fork } from 'node:child_process'
import { resolve } from 'node:path'
import v8 from 'node:v8'
import { BaseRuntime } from './base'

const SIGKILL_TIMEOUT = 1_000

/** @experimental */
export class ForksRuntime extends BaseRuntime {
  name = 'forks'
  entrypoint: string
  rpcOptions = { cacheFs: true }
  private fork?: ChildProcess

  constructor(options: PoolRuntime['options']) {
    options.cacheFs = true
    super(options)

    /** Loads {@link file://./../../../runtime/workers/forks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/forks.js')
  }

  onWorker(event: string, callback: (arg: any) => void): void {
    this.fork?.on(event, callback)
  }

  offWorker(event: string, callback: (arg: any) => void): void {
    this.fork?.off(event, callback)
  }

  postMessage(message: WorkerRequest): void {
    if (this.isTerminating) {
      return
    }

    if ('context' in message) {
      message = {
        ...message,
        context: {
          ...message.context,
          config: wrapSerializableConfig(message.context.config),
        },
      }
    }

    this.fork?.send(this.serialize(message))
  }

  async start(options: Parameters<PoolRuntime['start']>[0]): Promise<void> {
    this.fork ||= fork(this.entrypoint, [], options)

    await super.start(options)
  }

  private stopPromise: Promise<void> | undefined

  async stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise
    }

    this.stopPromise = (async () => {
      const waitForExit = new Promise<void>(resolve => this.fork?.once('exit', resolve))
      await super.stop()

      /*
       * If process running user's code does not stop on SIGTERM, send SIGKILL.
       * This is similar to
       * - https://github.com/jestjs/jest/blob/25a8785584c9d54a05887001ee7f498d489a5441/packages/jest-worker/src/workers/ChildProcessWorker.ts#L463-L477
       * - https://github.com/tinylibs/tinypool/blob/40b4b3eb926dabfbfd3d0a7e3d1222d4dd1c0d2d/src/runtime/process-worker.ts#L56
       */
      const sigkillTimeout = setTimeout(
        () => this.fork?.kill('SIGKILL'),
        SIGKILL_TIMEOUT,
      )

      this.fork?.kill()
      await waitForExit
      clearTimeout(sigkillTimeout)

      this.fork = undefined
    })().finally(() => (this.stopPromise = undefined))
    await this.stopPromise
  }

  serialize(data: any): any {
    return v8.serialize(data)
  }

  deserialize(data: any): any {
    try {
      return v8.deserialize(Buffer.from(data))
    }
    catch (error) {
      let stringified = ''

      try {
        stringified = `\nReceived value: ${JSON.stringify(data)}`
      }
      catch {}

      throw new Error(`[vitest-pool]: Unexpected call to process.send(). Make sure your test cases are not interfering with process's channel.${stringified}`, { cause: error })
    }
  }
}

/**
 * Prepares `SerializedConfig` for serialization, e.g. `node:v8.serialize`
 * - Unwrapping done in {@link file://./../../../runtime/workers/init-forks.ts}
 */
function wrapSerializableConfig(config: SerializedConfig) {
  let testNamePattern = config.testNamePattern
  let defines = config.defines

  // v8 serialize does not support regex
  if (testNamePattern && typeof testNamePattern !== 'string') {
    testNamePattern = `$$vitest:${testNamePattern.toString()}` as unknown as RegExp
  }

  // v8 serialize drops properties with undefined value
  if (defines) {
    defines = { keys: Object.keys(defines), original: defines }
  }

  return {
    ...config,
    testNamePattern,
    defines,
  } as SerializedConfig
}
