import type { ChildProcess } from 'node:child_process'
import type { Writable } from 'node:stream'
import type { PoolOptions, PoolWorker, WorkerRequest } from '../types'
import { fork } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { streamFlushed } from './utils'

const SIGKILL_TIMEOUT = 500 /** jest does 500ms by default, let's follow it */
// how long a failed pipe write may wait for the process's 'exit' event
// before it is reported as the worker error itself
const PIPE_ERROR_EXIT_GRACE = 1_000

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

  private _errorEmitter = new EventEmitter<{ error: [Error] }>()
  private _pipeErrorTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: PoolOptions) {
    this.execArgv = options.execArgv
    this.env = options.env
    this.stdout = options.project.vitest.logger.outputStream
    this.stderr = options.project.vitest.logger.errorStream

    /** Loads {@link file://./../../../runtime/workers/forks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/forks.js')
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (event === 'error') {
      this._errorEmitter.on('error', callback)
    }
    else {
      this.fork.on(event, callback)
    }
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (event === 'error') {
      this._errorEmitter.off('error', callback)
    }
    else {
      this.fork.off(event, callback)
    }
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

    this._fork.on('error', this.emitError)

    // `end: false`: the logger streams are shared by every worker, so one
    // ending worker stream must not end them for everyone else
    if (this._fork.stdout) {
      this.stdout.setMaxListeners(1 + this.stdout.getMaxListeners())
      this._fork.stdout.pipe(this.stdout, { end: false })
    }

    if (this._fork.stderr) {
      this.stderr.setMaxListeners(1 + this.stderr.getMaxListeners())
      this._fork.stderr.pipe(this.stderr, { end: false })
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
      await streamFlushed(fork.stdout)
      fork.stdout.unpipe(this.stdout)
      this.stdout.setMaxListeners(this.stdout.getMaxListeners() - 1)
    }

    if (fork.stderr) {
      await streamFlushed(fork.stderr)
      fork.stderr.unpipe(this.stderr)
      this.stderr.setMaxListeners(this.stderr.getMaxListeners() - 1)
    }

    this._fork = undefined
  }

  deserialize(data: unknown): unknown {
    return data
  }

  private emitError = (error: Error): void => {
    // A write into a dying child process fails with EPIPE (or a closed IPC
    // channel) and can be observed before the process's 'exit' event,
    // especially on macOS. The exit event knows the exit code, the signal and
    // the affected test files, so hold the write error and let the 'exit'
    // listeners report instead. The timer covers a broken channel whose
    // process never exits; a process that exited while the error was held was
    // already reported through the exit event, and a process whose listeners
    // were detached is being shut down deliberately — drop the error in both
    // cases.
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EPIPE' || code === 'ERR_IPC_CHANNEL_CLOSED') {
      if (this._pipeErrorTimer) {
        return
      }
      this._pipeErrorTimer = setTimeout(() => {
        this._pipeErrorTimer = undefined
        const fork = this._fork
        if (
          fork
          && fork.exitCode == null
          && fork.signalCode == null
          && this._errorEmitter.listenerCount('error')
        ) {
          this._errorEmitter.emit('error', error)
        }
      }, PIPE_ERROR_EXIT_GRACE)
      this._pipeErrorTimer.unref()
      return
    }

    this._errorEmitter.emit('error', error)
  }

  private get fork() {
    if (!this._fork) {
      throw new Error(`The child process was torn down or never initialized. This is a bug in Vitest.`)
    }
    return this._fork
  }
}
