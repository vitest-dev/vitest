import type { WorkerGlobalState } from '../../types/worker'
import type { VitestWorker } from './types'
import v8 from 'node:v8'
import { createForksRpcOptions, unwrapSerializableConfig } from './utils'
import { runVmTests } from './vm'

class ForksVmWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState) {
    const exit = process.exit
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runVmTests(method, state)
    }
    finally {
      process.exit = exit
    }
  }

  runTests(state: WorkerGlobalState) {
    return this.executeTests('run', state)
  }

  collectTests(state: WorkerGlobalState) {
    return this.executeTests('collect', state)
  }
}

export default new ForksVmWorker()
