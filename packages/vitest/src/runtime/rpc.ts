import type { BirpcReturn } from 'birpc'
import type { WorkerRPC } from '../types'

export const rpc: BirpcReturn<WorkerRPC>['call'] = (method, ...args) => {
  return process.__vitest_worker__?.rpc.call(method, ...args)
}

export const send: BirpcReturn<WorkerRPC>['send'] = (method, ...args) => {
  return process.__vitest_worker__?.rpc.send(method, ...args)
}
