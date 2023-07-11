import type { WorkerGlobalState } from '../types'

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}

export function getCurrentEnvironment(): string {
  const state = getWorkerState()
  return state?.environment.name
}
