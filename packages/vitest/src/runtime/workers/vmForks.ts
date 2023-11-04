import v8 from 'node:v8'
import type { ContextRPC } from '../../types/rpc'
import type { WorkerRpcOptions } from './types'
import { createForksRpcOptions } from './utils'
import { VmVitestWorker } from './vm'

export default class VmForksVitestWorker extends VmVitestWorker {
  constructor(protected ctx: ContextRPC) {
    super(ctx)
  }

  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }
}
