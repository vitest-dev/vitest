import type { PoolRuntimeOptions } from '../types'
import { resolve } from 'node:path'
import { ForksRuntimeWorker } from './forks'

/** @experimental */
export class VmForksRuntimeWorker extends ForksRuntimeWorker {
  public readonly name = 'vmForks'
  public readonly reportMemory = true
  protected readonly entrypoint: string

  constructor(options: PoolRuntimeOptions) {
    super({ ...options, execArgv: [...options.execArgv, '--experimental-vm-modules'] })

    /** Loads {@link file://./../../../runtime/workers/vmForks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmForks.js')
  }
}
