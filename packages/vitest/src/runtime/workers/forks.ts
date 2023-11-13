import v8 from 'node:v8'
import type { WorkerGlobalState } from '../../types/worker'
import { createForksRpcOptions, unwrapForksConfig } from './utils'
import { runBaseTests } from './base'
import type { VitestWorker } from './types'

class ForksBaseWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  runTests(state: WorkerGlobalState) {
    state.ctx.config = unwrapForksConfig(state.ctx.config)

    return runBaseTests(state)
  }
}

export default new ForksBaseWorker()
