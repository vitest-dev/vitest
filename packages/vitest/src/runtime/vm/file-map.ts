import fs from 'node:fs'

const { promises, readFileSync } = fs

// Memory management thresholds for LRU cache
const EVICTION_TRIGGER_RATIO = 0.9 // Start eviction at 90% of memory limit
const EVICTION_TARGET_RATIO = 0.8 // Evict down to 80% to provide buffer

export class FileMap {
  private fsCache = new Map<string, CacheEntry<string>>()
  private fsBufferCache = new Map<string, CacheEntry<Buffer<ArrayBuffer>>>()
  private totalMemory = 0
  private readonly maxMemory: number
  private readonly evictionThreshold: number

  constructor(options: { maxMemory?: number } = {}) {
    this.maxMemory = options.maxMemory ?? 50 * 1024 * 1024 // 50MB default
    this.evictionThreshold = this.maxMemory * EVICTION_TRIGGER_RATIO
  }

  private evictLRU(): void {
    // Evict down to target ratio to provide buffer for future allocations
    const targetMemory = this.maxMemory * EVICTION_TARGET_RATIO

    if (this.totalMemory <= targetMemory) {
      return
    }

    // Collect all entries with metadata for efficient sorting
    const allEntries: Array<{
      path: string
      lastAccess: number
      size: number
      type: 'string' | 'buffer'
    }> = []

    for (const [path, entry] of this.fsCache.entries()) {
      allEntries.push({
        path,
        lastAccess: entry.lastAccess,
        size: entry.size,
        type: 'string',
      })
    }

    for (const [path, entry] of this.fsBufferCache.entries()) {
      allEntries.push({
        path,
        lastAccess: entry.lastAccess,
        size: entry.size,
        type: 'buffer',
      })
    }

    // Sort once by access time (oldest first)
    allEntries.sort((a, b) => a.lastAccess - b.lastAccess)

    // Evict oldest entries until we reach target memory
    for (const entry of allEntries) {
      if (this.totalMemory <= targetMemory) {
        break
      }

      // Remove the entry from appropriate cache
      if (entry.type === 'string') {
        this.fsCache.delete(entry.path)
      }
      else {
        this.fsBufferCache.delete(entry.path)
      }

      this.totalMemory -= entry.size
    }
  }

  public async readFileAsync(path: string): Promise<string> {
    const cached = this.fsCache.get(path)
    if (cached != null) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    const source = await promises.readFile(path, 'utf-8')
    // length * 1.2 is a fast approximation of Buffer.byteLength() (~28x faster)
    const size = source.length * 1.2
    const entry: CacheEntry<string> = {
      data: source,
      lastAccess: Date.now(),
      size,
    }

    this.fsCache.set(path, entry)
    this.totalMemory += size

    // Only check for eviction when we exceed the threshold
    if (this.totalMemory > this.evictionThreshold) {
      this.evictLRU()
    }

    return source
  }

  public readFile(path: string): string {
    const cached = this.fsCache.get(path)
    if (cached != null) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    const source = readFileSync(path, 'utf-8')
    // Fast approximation of Buffer.byteLength() for performance (~28x faster)
    // Most source files are ASCII-heavy, so 1.2x provides reasonable overestimate
    const size = source.length * 1.2 // Replaces Buffer.byteLength(source, 'utf-8')
    const entry: CacheEntry<string> = {
      data: source,
      lastAccess: Date.now(),
      size,
    }

    this.fsCache.set(path, entry)
    this.totalMemory += size

    // Only check for eviction when we exceed the threshold
    if (this.totalMemory > this.evictionThreshold) {
      this.evictLRU()
    }

    return source
  }

  public readBuffer(path: string): Buffer<ArrayBuffer> {
    const cached = this.fsBufferCache.get(path)
    if (cached != null) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    const buffer = readFileSync(path)
    const entry: CacheEntry<Buffer<ArrayBuffer>> = {
      data: buffer,
      lastAccess: Date.now(),
      size: buffer.length,
    }

    this.fsBufferCache.set(path, entry)
    this.totalMemory += buffer.length

    // Only check for eviction when we exceed the threshold
    if (this.totalMemory > this.evictionThreshold) {
      this.evictLRU()
    }

    return buffer
  }
}

interface CacheEntry<T> {
  data: T
  lastAccess: number
  size: number
}
