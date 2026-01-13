import type { Awaitable } from '@vitest/utils'
import type { BirpcOptions } from 'birpc'
import type { ModuleRunner } from 'vite/module-runner'
import type { RuntimeRPC } from '../../types/rpc'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'

type WorkerRpcOptions = Pick<
  BirpcOptions<RuntimeRPC>,
  'on' | 'off' | 'post' | 'serialize' | 'deserialize'
>

export interface VitestWorker extends WorkerRpcOptions {
  runTests: (state: WorkerGlobalState, traces: Traces) => Awaitable<unknown>
  collectTests: (state: WorkerGlobalState, traces: Traces) => Awaitable<unknown>
  onModuleRunner?: (moduleRunner: ModuleRunner) => Awaitable<unknown>
  setup?: (context: WorkerSetupContext) => void | Promise<() => Promise<unknown>>
}
