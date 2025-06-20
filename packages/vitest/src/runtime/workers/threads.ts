import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import { runBaseTests } from './base'
import { createThreadsRpcOptions } from './utils'

class ThreadsBaseWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC): WorkerRpcOptions {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runBaseTests('run', state)
  }

  collectTests(state: WorkerGlobalState): unknown {
    return runBaseTests('collect', state)
  }
}

const worker: ThreadsBaseWorker = new ThreadsBaseWorker()
export default worker
