import type { PoolRuntime } from '../types'
import { resolve } from 'node:path'
import { ThreadsRuntime } from './threads'

/** @experimental */
export class VmThreadsRuntime extends ThreadsRuntime {
  name = 'vmThreads'
  reportMemory = true
  entrypoint: string

  constructor(options: PoolRuntime['options']) {
    super(options)

    /** Loads {@link file://./../../../runtime/workers/vmThreads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmThreads.js')
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
