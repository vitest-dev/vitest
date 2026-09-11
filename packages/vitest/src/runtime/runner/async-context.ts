export type AsyncContextSnapshot = <T>(fn: () => T) => T

let createAsyncContextSnapshot: (() => AsyncContextSnapshot) | undefined

export function setAsyncContextSnapshotFactory(
  factory: (() => AsyncContextSnapshot) | undefined,
): void {
  createAsyncContextSnapshot = factory
}

// Snapshots replace the whole async frame
// So only test-scoped fixtures participate: a shared chain would leak between tests and erase aroundAll contexts
const chains = new WeakMap<object, AsyncContextSnapshot>()

export function advanceAsyncContextChain(key: object): void {
  if (createAsyncContextSnapshot) {
    chains.set(key, createAsyncContextSnapshot())
  }
}

// Re-captures only an existing chain
// So fixture-less pipelines keep invoking callbacks natively (identical stack traces)
export function refreshAsyncContextChain(key: object): void {
  if (createAsyncContextSnapshot && chains.has(key)) {
    chains.set(key, createAsyncContextSnapshot())
  }
}

// On undefined, callers must invoke their function directly
// Because a wrapper would push outer async frames past `Error.stackTraceLimit`
export function getAsyncContextChain(
  key: object | undefined,
): AsyncContextSnapshot | undefined {
  return key ? chains.get(key) : undefined
}

export function clearAsyncContextChain(key: object): void {
  chains.delete(key)
}
