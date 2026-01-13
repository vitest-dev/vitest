import type { ChildProcess } from 'node:child_process'
import type { Writable } from 'node:stream'
import type { PoolOptions, PoolWorker, WorkerRequest } from '../types'
import { fork } from 'node:child_process'
import { resolve } from 'node:path'

const SIGKILL_TIMEOUT = 500 /** jest does 500ms by default, let's follow it */

/** @experimental */
export class ForksPoolWorker implements PoolWorker {
  public readonly name: string = 'forks'
  public readonly cacheFs: boolean = true

  protected readonly entrypoint: string
  protected execArgv: string[]
  protected env: Partial<NodeJS.ProcessEnv>

  private _fork?: ChildProcess
  private stdout: NodeJS.WriteStream | Writable
  private stderr: NodeJS.WriteStream | Writable

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
    this.stdout = options.project.vitest.logger.outputStream
    this.stderr = options.project.vitest.logger.errorStream

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
    this.fork.send(message)
  }

  async start(): Promise<void> {
    this._fork ||= fork(this.entrypoint, [], {
      env: this.env,
      execArgv: this.execArgv,
      stdio: 'pipe',
      serialization: 'advanced',
    })

    if (this._fork.stdout) {
      this.stdout.setMaxListeners(1 + this.stdout.getMaxListeners())
      this._fork.stdout.pipe(this.stdout)
    }

    if (this._fork.stderr) {
      this.stderr.setMaxListeners(1 + this.stderr.getMaxListeners())
      this._fork.stderr.pipe(this.stderr)
    }
  }

  async stop(): Promise<void> {
    const fork = this.fork
    const waitForExit = new Promise<void>((resolve) => {
      if (fork.exitCode != null) {
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

    if (fork.stdout) {
      fork.stdout?.unpipe(this.stdout)
      this.stdout.setMaxListeners(this.stdout.getMaxListeners() - 1)
    }

    if (fork.stderr) {
      fork.stderr?.unpipe(this.stderr)
      this.stderr.setMaxListeners(this.stderr.getMaxListeners() - 1)
    }

    this._fork = undefined
  }

  deserialize(data: unknown): unknown {
    return data
  }

  private get fork() {
    if (!this._fork) {
      throw new Error(`The child process was torn down or never initialized. This is a bug in Vitest.`)
    }
    return this._fork
  }
}
