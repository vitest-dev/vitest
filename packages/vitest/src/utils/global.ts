import type { WorkerGlobalState } from '../types'

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}
