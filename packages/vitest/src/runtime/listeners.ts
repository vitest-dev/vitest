import type { ModuleRunner } from 'vite/module-runner'

const cleanupListeners = new Set<() => unknown>()
const moduleRunnerListeners = new Set<(runner: ModuleRunner) => unknown>()

export function onCleanup(cb: () => unknown): void {
  cleanupListeners.add(cb)
}

export async function cleanup(): Promise<void> {
  const listeners = Array.from(cleanupListeners)
  // the listeners are in-context closures (worker-scoped fixture cleanups):
  // once they ran, keeping them registered would both re-run them on worker
  // teardown and pin their test file's world for the lifetime of the worker
  cleanupListeners.clear()
  await Promise.all(listeners.map(l => l()))
}

export function onModuleRunner(cb: (runner: ModuleRunner) => unknown): void {
  moduleRunnerListeners.add(cb)
}

export function emitModuleRunner(moduleRunner: ModuleRunner): void {
  moduleRunnerListeners.forEach(l => l(moduleRunner))
}
