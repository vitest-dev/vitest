import type { PoolRuntime } from '../types'
import { resolve } from 'node:path'
import { ForksRuntime } from './forks'

/** @experimental */
export class VmForksRuntime extends ForksRuntime {
  name = 'vmForks'
  reportMemory = true

  constructor(options: PoolRuntime['options']) {
    super(options)

    /** Loads {@link file://./../../../runtime/workers/vmForks.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmForks.js')
  }

  async start(options: Parameters<PoolRuntime['start']>[0]): Promise<void> {
    return super.start({
      ...options,
      execArgv: [
        ...options.execArgv,
        '--experimental-vm-modules',
      ],
    })
  }
}
