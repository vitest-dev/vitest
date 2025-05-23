const listeners = new Set<() => unknown>()

export function addCleanupListener(listener: () => unknown): void {
  listeners.add(listener)
}

export function removeCleanupListener(listener: () => unknown): void {
  listeners.delete(listener)
}

export async function cleanup(): Promise<void> {
  const promises = [...listeners].map(l => l())
  await Promise.all(promises)
}
