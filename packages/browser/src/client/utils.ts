import type { VitestRunner } from '@vitest/runner'
import type { SerializedConfig, WorkerGlobalState } from 'vitest'
import type { IframeOrchestrator } from './orchestrator'
import type { CommandsManager } from './tester/utils'

export async function importId(id: string): Promise<any> {
  const name = `/@id/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export async function importFs(id: string): Promise<any> {
  const name = `/@fs/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export const executor = {
  isBrowser: true,

  executeId: (id: string): Promise<any> => {
    if (id[0] === '/' || id[1] === ':') {
      return importFs(id)
    }
    return importId(id)
  },
}

export function getConfig(): SerializedConfig {
  return getBrowserState().config
}

export function ensureAwaited<T>(promise: (error?: Error) => Promise<T>): Promise<T> {
  const test = getWorkerState().current
  if (!test || test.type !== 'test') {
    return promise()
  }
  let awaited = false
  const sourceError = new Error('STACK_TRACE_ERROR')
  test.onFinished ??= []
  test.onFinished.push(() => {
    if (!awaited) {
      const error = new Error(
        `The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.`,
      )
      error.stack = sourceError.stack?.replace(sourceError.message, error.message)
      throw error
    }
  })
  // don't even start the promise if it's not awaited to not cause any unhanded promise rejections
  let promiseResult: Promise<T> | undefined
  return {
    then(onFulfilled, onRejected) {
      awaited = true
      return (promiseResult ||= promise(sourceError)).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return (promiseResult ||= promise(sourceError)).catch(onRejected)
    },
    finally(onFinally) {
      return (promiseResult ||= promise(sourceError)).finally(onFinally)
    },
    [Symbol.toStringTag]: 'Promise',
  } satisfies Promise<T>
}

export interface BrowserRunnerState {
  files: string[]
  runningFiles: string[]
  moduleCache: Map<string, any>
  config: SerializedConfig
  provider: string
  runner: VitestRunner
  viteConfig: {
    root: string
  }
  providedContext: string
  type: 'tester' | 'orchestrator'
  wrapModule: <T>(module: () => T) => T
  iframeId?: string
  sessionId: string
  testerId: string
  method: 'run' | 'collect'
  orchestrator?: IframeOrchestrator
  commands: CommandsManager
  cleanups: Array<() => unknown>
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
