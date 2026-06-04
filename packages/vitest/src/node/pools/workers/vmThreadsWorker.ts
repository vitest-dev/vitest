import type { PoolOptions } from '../types'
import { resolve } from 'node:path'
import { ThreadsPoolWorker } from './threadsWorker'

/** @experimental */
export class VmThreadsPoolWorker extends ThreadsPoolWorker {
  public readonly name = 'vmThreads'
  public readonly reportMemory = true
  protected readonly entrypoint: string

  constructor(options: PoolOptions) {
    super({ ...options, execArgv: [...options.execArgv, '--experimental-vm-modules'] })

    /** Loads {@link file://./../../../runtime/workers/vmThreads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmThreads.js')
  }

  canReuse(): boolean {
    return true
  }
}
