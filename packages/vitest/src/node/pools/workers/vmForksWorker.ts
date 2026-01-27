import type { PoolOptions } from '../types'
import { resolve } from 'node:path'
import { ForksPoolWorker } from './forksWorker'

/** @experimental */
export class VmForksPoolWorker extends ForksPoolWorker {
  public readonly name = 'vmForks'
  public readonly reportMemory = true
  protected readonly entrypoint: string

  constructor(options: PoolOptions) {
    super({ ...options, execArgv: [...options.execArgv, '--experimental-vm-modules'] })

    /** Loads {@link file://./../../../runtime/workers/vmForks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmForks.js')
  }

  canReuse(): boolean {
    return true
  }
}
