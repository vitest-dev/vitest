import v8 from 'node:v8'
import type { ContextRPC } from '../../types/rpc'
import type { WorkerRpcOptions } from './types'
import { BaseVitestWorker } from './base'
import { createForksRpcOptions } from './utils'

export default class ForksVitestWorker extends BaseVitestWorker {
  constructor(protected ctx: ContextRPC) {
    super(ctx)
  }

  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }
}
