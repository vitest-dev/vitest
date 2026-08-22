interface CodeCacheEntry {
  source: string
  data: Buffer | undefined
}

/**
 * Worker-wide cache of V8 code cache buffers for externalized modules.
 *
 * vm pools create a fresh executor per test file, so every externalized
 * module is compiled and evaluated again in each fresh context. The compiled
 * code has no per-context state — reusing its V8 code cache skips the
 * re-parse/re-compile while the evaluation still happens per context.
 *
 * Entries are keyed by the module identifier and guarded by the exact source
 * text, so an invalidated module that produces different code simply replaces
 * its entry.
 */
export class CodeCache {
  private entries = new Map<string, CodeCacheEntry>()

  get(identifier: string, source: string): Buffer | undefined {
    const entry = this.entries.get(identifier)
    if (entry && entry.source === source) {
      return entry.data
    }
    return undefined
  }

  /**
   * Stores the code cache produced by `produce` unless an entry for the same
   * source already exists. A `produce` failure is recorded as an empty entry,
   * so it is not retried on every fresh context.
   */
  store(identifier: string, source: string, produce: () => Buffer): void {
    const entry = this.entries.get(identifier)
    if (entry && entry.source === source) {
      return
    }
    let data: Buffer | undefined
    try {
      data = produce()
    }
    catch {
      data = undefined
    }
    this.entries.set(identifier, { source, data })
  }

  delete(identifier: string): void {
    this.entries.delete(identifier)
  }

  clear(): void {
    this.entries.clear()
  }
}

/**
 * `node:v8` as seen inside the vm context: changing V8 flags invalidates every
 * code cache produced so far, so `setFlagsFromString` also empties ours.
 */
export function createV8ModuleWithCacheReset<T extends { setFlagsFromString: (flags: string) => void }>(
  v8: T,
  codeCache: CodeCache,
): T {
  const patched = Object.create(Object.getPrototypeOf(v8), Object.getOwnPropertyDescriptors(v8)) as T
  patched.setFlagsFromString = function setFlagsFromString(flags: string): void {
    v8.setFlagsFromString(flags)
    codeCache.clear()
  }
  return patched
}
