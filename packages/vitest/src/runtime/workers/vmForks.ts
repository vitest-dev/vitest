import v8 from 'node:v8'
import type { ContextRPC } from '../../types/rpc'
import type { WorkerGlobalState } from '../../types/worker'
import type { WorkerRpcOptions } from './types'
import { createForksRpcOptions, unwrapForksConfig } from './utils'
import { VmVitestWorker } from './vm'

export default class VmForksVitestWorker extends VmVitestWorker {
  constructor(protected ctx: ContextRPC) {
    super(ctx)
  }

  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }

  runTests(state: WorkerGlobalState): Promise<void> {
    state.ctx.config = unwrapForksConfig(state.ctx.config)

    return super.runTests(state)
  }
}
