import v8 from 'node:v8'
import type { WorkerGlobalState } from '../../types/worker'
import { createForksRpcOptions, unwrapForksConfig } from './utils'
import type { VitestWorker } from './types'
import { runVmTests } from './vm'

class ForksVmWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  async runTests(state: WorkerGlobalState) {
    const exit = process.exit
    state.ctx.config = unwrapForksConfig(state.ctx.config)

    try {
      await runVmTests(state)
    }
    finally {
      process.exit = exit
    }
  }
}

export default new ForksVmWorker()
