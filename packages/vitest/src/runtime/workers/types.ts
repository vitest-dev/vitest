import type { BirpcOptions } from 'birpc'
import type { Awaitable } from '@vitest/utils'
import type { ContextRPC, RuntimeRPC } from '../../types/rpc'
import type { WorkerGlobalState } from '../../types/worker'

export type WorkerRpcOptions = Pick<
  BirpcOptions<RuntimeRPC>,
  'on' | 'post' | 'serialize' | 'deserialize'
>

export interface VitestWorker {
  getRpcOptions: (ctx: ContextRPC) => WorkerRpcOptions
  runTests: (state: WorkerGlobalState) => Awaitable<unknown>
}
