import type { VitestEnvironment, WorkerGlobalState } from '../types'

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}

export function getCurrentEnvironment(): VitestEnvironment {
  // @ts-expect-error untyped global
  return globalThis.__vitest_environment__
}
