import type { WorkerContext } from '../../types/worker'
import type { WorkerRpcOptions } from './types'
import { BaseVitestWorker } from './base'
import { createThreadsRpcOptions } from './utils'

export default class ThreadsVitestWorker extends BaseVitestWorker {
  constructor(protected ctx: WorkerContext) {
    super(ctx)
  }

  getRpcOptions(): WorkerRpcOptions {
    return createThreadsRpcOptions(this.ctx.port)
  }
}
