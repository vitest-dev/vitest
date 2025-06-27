import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import v8 from 'node:v8'
import { createForksRpcOptions, unwrapSerializableConfig } from './utils'
import { runVmTests } from './vm'

class ForksVmWorker implements VitestWorker {
  getRpcOptions(ctx?: ContextRPC): WorkerRpcOptions {
    return createForksRpcOptions(v8, ctx?.config?.testTimeout)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
    const exit = process.exit
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runVmTests(method, state)
    }
    finally {
      process.exit = exit
    }
  }

  runTests(state: WorkerGlobalState): Promise<void> {
    return this.executeTests('run', state)
  }

  collectTests(state: WorkerGlobalState): Promise<void> {
    return this.executeTests('collect', state)
  }
}

const worker: ForksVmWorker = new ForksVmWorker()
export default worker
