import type { ModuleRunner } from 'vite/module-runner'

const cleanupListeners = new Set<() => unknown>()
const moduleRunnerListeners = new Set<(runner: ModuleRunner) => unknown>()

export function onCleanup(cb: () => unknown): void {
  cleanupListeners.add(cb)
}

export async function cleanup(): Promise<void> {
  await Promise.all([...cleanupListeners].map(l => l()))
}

export function onModuleRunner(cb: (runner: ModuleRunner) => unknown): void {
  moduleRunnerListeners.add(cb)
}

export function emitModuleRunner(moduleRunner: ModuleRunner): void {
  moduleRunnerListeners.forEach(l => l(moduleRunner))
}
