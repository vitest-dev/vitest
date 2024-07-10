import type { ResolvedConfig, WorkerGlobalState } from 'vitest'

export async function importId(id: string) {
  const name = `/@id/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export async function importFs(id: string) {
  const name = `/@fs/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export function getConfig(): ResolvedConfig {
  return getBrowserState().config
}

export interface BrowserRunnerState {
  files: string[]
  runningFiles: string[]
  moduleCache: WorkerGlobalState['moduleCache']
  config: ResolvedConfig
  provider: string
  viteConfig: {
    root: string
  }
  providedContext: string
  type: 'tester' | 'orchestrator'
  wrapModule: <T>(module: () => T) => T
  iframeId?: string
  contextId: string
  testerId: string
  runTests?: (tests: string[]) => Promise<void>
  createTesters?: (files: string[]) => Promise<void>
  cdp?: {
    on: (event: string, listener: (payload: any) => void) => void
    once: (event: string, listener: (payload: any) => void) => void
    off: (event: string, listener: (payload: any) => void) => void
    send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
    emit: (event: string, payload: unknown) => void
  }
}

/* @__NO_SIDE_EFFECTS__ */
export function getBrowserState(): BrowserRunnerState {
  // @ts-expect-error not typed global
  return window.__vitest_browser_runner__
}

/* @__NO_SIDE_EFFECTS__ */
export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error not typed global
  const state = window.__vitest_worker__
  if (!state) {
    throw new Error('Worker state is not found. This is an issue with Vitest. Please, open an issue.')
  }
  return state
}
