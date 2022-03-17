import { getWorkerState } from '../utils'

export const rpc = () => {
  return getWorkerState().rpc
}
