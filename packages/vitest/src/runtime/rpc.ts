import type { RpcCall, RpcSend } from '../types'

export const rpc: RpcCall = async(method, ...args) => {
  return process.__vitest_worker__?.rpc(method, ...args)
}

export const send: RpcSend = async(method, ...args) => {
  return process.__vitest_worker__?.send(method, ...args)
}
