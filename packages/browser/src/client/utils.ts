import type { ResolvedConfig, WorkerGlobalState } from 'vitest'

export async function importId(id: string) {
  const name = `${getConfig().base || '/'}@id/${id}`
  // @ts-expect-error mocking vitest apis
  return __vi_wrap_module__(import(name))
}

export function getConfig(): ResolvedConfig {
  // @ts-expect-error not typed global
  return window.__vi_config__
}

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error not typed global
  return window.__vi_worker_state__
}
