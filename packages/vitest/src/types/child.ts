import type { ContextRPC } from './rpc'

export interface ChildContext extends ContextRPC {
  workerId: number
}
