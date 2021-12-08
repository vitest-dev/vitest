import { RpcFn } from '../types'

export const rpc: RpcFn = async(method, ...args) => {
  return process.__vitest_worker__?.rpc(method, ...args)
}
