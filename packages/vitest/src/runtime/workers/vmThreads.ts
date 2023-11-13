import type { WorkerContext, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import { createThreadsRpcOptions } from './utils'
import { runVmTests } from './vm'

class ThreadsVmWorker implements VitestWorker {
  getRpcOptions(ctx: WorkerContext): WorkerRpcOptions {
    return createThreadsRpcOptions(ctx)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runVmTests(state)
  }
}

export default new ThreadsVmWorker()
