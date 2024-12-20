import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker } from './types'
import { runBaseTests } from './base'
import { createThreadsRpcOptions } from './utils'

class ThreadsBaseWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC) {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runBaseTests('run', state)
  }

  collectTests(state: WorkerGlobalState): unknown {
    return runBaseTests('collect', state)
  }
}

export default new ThreadsBaseWorker()
