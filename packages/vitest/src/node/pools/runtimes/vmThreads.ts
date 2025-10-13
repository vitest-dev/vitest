import type { Runtime } from '../types'
import { resolve } from 'node:path'
import { ThreadsRuntime } from './threads'

export class VmThreadsRuntime extends ThreadsRuntime {
  name = 'vmThreads'
  reportMemory = true
  entrypoint: string

  constructor(options: Runtime['options']) {
    super(options)

    /** Loads {@link file://./../../../runtime/workers/vmThreads.ts} */
    this.entrypoint = resolve(options.distPath, 'workers/vmThreads.js')
  }

  async start(options: Parameters<Runtime['start']>[0]): Promise<void> {
    return super.start({
      ...options,
      execArgv: [
        ...options.execArgv,
        '--experimental-vm-modules',
      ],
    })
  }
}
