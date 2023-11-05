import v8 from 'node:v8'
import type { ContextRPC } from '../../types/rpc'
import type { WorkerGlobalState } from '../../types/worker'
import type { WorkerRpcOptions } from './types'
import { BaseVitestWorker } from './base'
import { createForksRpcOptions, unwrapForksConfig } from './utils'

export default class ForksVitestWorker extends BaseVitestWorker {
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
