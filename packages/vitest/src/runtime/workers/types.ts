import type { Awaitable } from '@vitest/utils'
import type { BirpcOptions } from 'birpc'
import type { RuntimeRPC } from '../../types/rpc'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'

type WorkerRpcOptions = Pick<
  BirpcOptions<RuntimeRPC>,
  'on' | 'off' | 'post' | 'serialize' | 'deserialize'
>

export interface VitestWorker extends WorkerRpcOptions {
  runTests: (state: WorkerGlobalState) => Awaitable<unknown>
  collectTests: (state: WorkerGlobalState) => Awaitable<unknown>

  setup?: (context: WorkerSetupContext) => Promise<() => Promise<unknown>>
}
