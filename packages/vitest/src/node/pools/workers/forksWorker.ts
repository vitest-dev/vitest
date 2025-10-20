import type { ChildProcess } from 'node:child_process'
import type { SerializedConfig } from '../../types/config'
import type { PoolOptions, PoolWorker, WorkerRequest } from '../types'
import { fork } from 'node:child_process'
import { resolve } from 'node:path'
import v8 from 'node:v8'

const SIGKILL_TIMEOUT = 500 /** jest does 500ms by default, let's follow it */

/** @experimental */
export class ForksPoolWorker implements PoolWorker {
  public readonly name: string = 'forks'
  public readonly execArgv: string[]
  public readonly env: Record<string, string>
  public readonly cacheFs: boolean = true

  protected readonly entrypoint: string

  private _fork?: ChildProcess

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
    /** Loads {@link file://./../../../runtime/workers/forks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/forks.js')
  }

  on(event: string, callback: (arg: any) => void): void {
    this.fork.on(event, callback)
  }

  off(event: string, callback: (arg: any) => void): void {
    this.fork.off(event, callback)
  }

  send(message: WorkerRequest): void {
    if ('context' in message) {
      message = {
        ...message,
        context: {
          ...message.context,
          config: wrapSerializableConfig(message.context.config),
        },
      }
    }

    this.fork.send(v8.serialize(message))
  }

  async start(): Promise<void> {
    this._fork ||= fork(this.entrypoint, [], {
      env: this.env,
      execArgv: this.execArgv,
    })
  }

  async stop(): Promise<void> {
    const fork = this.fork
    const waitForExit = new Promise<void>((resolve) => {
      if (fork.killed) {
        resolve()
      }
      else {
        fork.once('exit', resolve)
      }
    })

    /*
     * If process running user's code does not stop on SIGTERM, send SIGKILL.
     * This is similar to
     * - https://github.com/jestjs/jest/blob/25a8785584c9d54a05887001ee7f498d489a5441/packages/jest-worker/src/workers/ChildProcessWorker.ts#L463-L477
     * - https://github.com/tinylibs/tinypool/blob/40b4b3eb926dabfbfd3d0a7e3d1222d4dd1c0d2d/src/runtime/process-worker.ts#L56
     */
    const sigkillTimeout = setTimeout(
      () => fork.kill('SIGKILL'),
      SIGKILL_TIMEOUT,
    )

    fork.kill()
    await waitForExit
    clearTimeout(sigkillTimeout)

    this._fork = undefined
  }

  deserialize(data: unknown): unknown {
    try {
      return v8.deserialize(Buffer.from(data as ArrayBuffer))
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

  private get fork() {
    if (!this._fork) {
      throw new Error(`The child process was torn down or never initialized. This is a bug in Vitest.`)
    }
    return this._fork
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
