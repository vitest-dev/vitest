import type { ResolvedConfig, WorkerGlobalState } from 'vitest'

export async function importId(id: string) {
  const name = `${getConfig().base || '/'}@id/${id}`
  return getBrowserState().wrapModule(() => import(name))
}

export function getConfig(): ResolvedConfig {
  return getBrowserState().config
}

interface BrowserRunnerState {
  files: string[]
  runningFiles: string[]
  moduleCache: WorkerGlobalState['moduleCache']
  config: ResolvedConfig
  type: 'tester' | 'orchestrator'
  wrapModule: <T>(module: () => T) => T
  runTests: (tests: string[]) => Promise<void>
}

export function getBrowserState(): BrowserRunnerState {
  // @ts-expect-error not typed global
  return window.__vitest_browser_runner__
}
