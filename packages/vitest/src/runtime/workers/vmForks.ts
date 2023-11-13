import v8 from 'node:v8'
import type { WorkerGlobalState } from '../../types/worker'
import { createForksRpcOptions, unwrapForksConfig } from './utils'
import type { VitestWorker } from './types'
import { runVmTests } from './vm'

class ForksVmWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  runTests(state: WorkerGlobalState) {
    state.ctx.config = unwrapForksConfig(state.ctx.config)

    return runVmTests(state)
  }
}

export default new ForksVmWorker()
