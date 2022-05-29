import { getWorkerState, withSafeTimers } from '../utils'

export const rpc = () => {
  const { rpc } = getWorkerState()
  return new Proxy(rpc, {
    get(target, p, handler) {
      const sendCall = Reflect.get(target, p, handler)
      const safeSendCall = (...args: any[]) => withSafeTimers(() => sendCall(...args))
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}
