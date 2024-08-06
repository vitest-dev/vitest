import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import { createThreadsRpcOptions } from './utils'
import { runVmTests } from './vm'

class ThreadsVmWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC): WorkerRpcOptions {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runVmTests('run', state)
  }

  collectTests(state: WorkerGlobalState): unknown {
    return runVmTests('collect', state)
  }
}

export default new ThreadsVmWorker()
