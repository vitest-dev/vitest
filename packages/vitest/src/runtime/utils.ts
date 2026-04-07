import type { EvaluatedModules } from 'vite/module-runner'
import type { WorkerGlobalState } from '../types/worker'
import { getSafeTimers } from '@vitest/utils/timers'

const NAME_WORKER_STATE = '__vitest_worker__'

export class EnvironmentTeardownError extends Error {
  name = 'EnvironmentTeardownError'
}

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  const workerState = globalThis[NAME_WORKER_STATE]
  if (!workerState) {
    const errorMsg
      = 'Vitest failed to access its internal state.'
        + '\n\nOne of the following is possible:'
        + '\n- "vitest" is imported directly without running "vitest" command'
        + '\n- "vitest" is imported inside "globalSetup" (to fix this, use "setupFiles" instead, because "globalSetup" runs in a different context)'
        + '\n- "vitest" is imported inside Vite / Vitest config file'
        + '\n- Otherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n'
    throw new Error(errorMsg)
  }
  return workerState
}

export function getSafeWorkerState(): WorkerGlobalState | undefined {
  // @ts-expect-error untyped global
  return globalThis[NAME_WORKER_STATE]
}

export function provideWorkerState(context: any, state: WorkerGlobalState): WorkerGlobalState {
  Object.defineProperty(context, NAME_WORKER_STATE, {
    value: state,
    configurable: true,
    writable: true,
    enumerable: false,
  })

  return state
}

export function getCurrentEnvironment(): string {
  const state = getWorkerState()
  return state?.environment.name
}

export function isChildProcess(): boolean {
  return typeof process !== 'undefined' && !!process.send
}

export function resetModules(modules: EvaluatedModules, resetMocks = false): void {
  const skipPaths = [
    // Vitest
    /\/vitest\/dist\//,
    // yarn's .store folder
    /vitest-virtual-\w+\/dist/,
    // cnpm
    /@vitest\/dist/,
    // don't clear mocks
    ...(!resetMocks ? [/^mock:/] : []),
  ]
  modules.idToModuleMap.forEach((node, path) => {
    if (skipPaths.some(re => re.test(path))) {
      return
    }

    node.promise = undefined
    node.exports = undefined
    node.evaluated = false
    node.importers.clear()
  })
}

function waitNextTick() {
  const { setTimeout } = getSafeTimers()
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function waitForImportsToResolve(): Promise<void> {
  await waitNextTick()
  const state = getWorkerState()
  const promises: Promise<unknown>[] = []
  const resolvingCount = state.resolvingModules.size
  for (const [_, mod] of state.evaluatedModules.idToModuleMap) {
    if (mod.promise && !mod.evaluated) {
      promises.push(mod.promise)
    }
  }
  if (!promises.length && !resolvingCount) {
    return
  }
  await Promise.allSettled(promises)
  await waitForImportsToResolve()
}
