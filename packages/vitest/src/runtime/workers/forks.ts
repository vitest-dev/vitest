import v8 from 'node:v8'
import type { WorkerGlobalState } from '../../types/worker'
import { createForksRpcOptions, unwrapSerializableConfig } from './utils'
import { runBaseTests } from './base'
import type { VitestWorker } from './types'

class ForksBaseWorker implements VitestWorker {
  getRpcOptions() {
    return createForksRpcOptions(v8)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState) {
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

  runTests(state: WorkerGlobalState) {
    return this.executeTests('run', state)
  }

  collectTests(state: WorkerGlobalState) {
    return this.executeTests('collect', state)
  }
}

export default new ForksBaseWorker()
