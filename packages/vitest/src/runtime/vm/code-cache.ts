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
}
