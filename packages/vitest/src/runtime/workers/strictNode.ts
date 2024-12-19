import type { Awaitable } from '@vitest/utils'
import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker } from './types'
import { resolve } from 'node:path'
import { VitestMocker } from '../mocker'
import { runBaseTests } from './base'
import { createThreadsRpcOptions } from './utils'

class StrictNodeThreadsWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC) {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): Awaitable<unknown> {
    const executor = {
      executeId: (id: string) => import(resolve(state.config.root, id)),
      executeFile: (id: string) => import(resolve(state.config.root, id)),
      options: {
        context: undefined,
      },
    } as any
    executor.mocker = new VitestMocker(executor)
    return runBaseTests('run', state, executor)
  }

  collectTests(_state: WorkerGlobalState): Awaitable<unknown> {
    throw new Error('Method not implemented.')
  }
}

export default new StrictNodeThreadsWorker()
