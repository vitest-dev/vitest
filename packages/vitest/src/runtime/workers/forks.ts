import type { WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import v8 from 'node:v8'
import { runBaseTests } from './base'
import { createForksRpcOptions, unwrapSerializableConfig } from './utils'

class ForksBaseWorker implements VitestWorker {
  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
    // TODO: don't rely on reassigning process.exit
    // https://github.com/vitest-dev/vitest/pull/4441#discussion_r1443771486
    const exit = process.exit
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runBaseTests(method, state)
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

const worker: ForksBaseWorker = new ForksBaseWorker()
export default worker
