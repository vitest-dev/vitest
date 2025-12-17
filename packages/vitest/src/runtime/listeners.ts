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

export async function emitModuleRunner(moduleRunner: ModuleRunner): Promise<void> {
  await Promise.all([...moduleRunnerListeners].map(l => l(moduleRunner)))
}
