import v8 from 'node:v8'
import type { WorkerGlobalState } from '../../types/worker'
import { createForksRpcOptions, unwrapForksConfig } from './utils'
import { runBaseTests } from './base'
import type { VitestWorker } from './types'

class ForksBaseWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  async runTests(state: WorkerGlobalState) {
    const exit = process.exit
    state.ctx.config = unwrapForksConfig(state.ctx.config)

    try {
      await runBaseTests(state)
    }
    finally {
      process.exit = exit
    }
  }
}

export default new ForksBaseWorker()
