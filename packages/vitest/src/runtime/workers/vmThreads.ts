import type { WorkerContext } from '../../types/worker'
import type { WorkerRpcOptions } from './types'
import { createThreadsRpcOptions } from './utils'
import { VmVitestWorker } from './vm'

export default class VmThreadsVitestWorker extends VmVitestWorker {
  constructor(protected ctx: WorkerContext) {
    super(ctx)
  }

  getRpcOptions(): WorkerRpcOptions {
    return createThreadsRpcOptions(this.ctx.port)
  }
}
