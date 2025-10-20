import type { PoolRuntimeOptions } from '../types'
import { resolve } from 'node:path'
import { ThreadsRuntimeWorker } from './threads'

/** @experimental */
export class VmThreadsRuntimeWorker extends ThreadsRuntimeWorker {
  public readonly name = 'vmThreads'
  public readonly reportMemory = true
  protected readonly entrypoint: string

  constructor(options: PoolRuntimeOptions) {
    super({ ...options, execArgv: [...options.execArgv, '--experimental-vm-modules'] })

    /** Loads {@link file://./../../../runtime/workers/vmThreads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmThreads.js')
  }
}
