/*
 * Regression: when `experimental.fsModuleCache` is enabled, the v8 coverage
 * provider used to silently drop files from the istanbul output on cache
 * hits, because the cache read path recovered the source map only by
 * re-parsing the inlined `//# sourceMappingURL` comment — which is missing
 * for any transform whose map lacks a `version` field (e.g. the rollup
 * `{ mappings: '' }` sentinel).
 *
 * The fix stores the map explicitly in the cache meta and prefers it on
 * read. This test locks the contract at the cache-class level so future
 * refactors do not silently regress coverage again.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { FileSystemModuleCache } from '../../../packages/vitest/src/node/cache/fsModuleCache'

function makeCache() {
  // Minimal Vitest stub — FileSystemModuleCache only reads `vite.config.root`
  // and `config.experimental.fsModuleCachePath` during construction.
  const vitest = {
    vite: { config: { root: process.cwd() } },
    config: { experimental: {}, coverage: { enabled: false } },
    projects: [],
    coverageProvider: undefined,
  } as any
  return new FileSystemModuleCache(vitest)
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'vitest-fs-cache-'))
  try {
    return await fn(dir)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('saveCachedModule preserves the source map across a round trip', async () => {
  const sampleMap = {
    version: 3 as const,
    sources: ['src/even.ts'],
    sourcesContent: ['export const even = (n: number) => n % 2 === 0'],
    names: [],
    mappings: 'AAAA,OAAO,MAAM,CAAC',
  }

  await withTmp(async (dir) => {
    const cache = makeCache()
    const cachedFilePath = join(dir, 'entry.js')

    await cache.saveCachedModule(cachedFilePath, {
      file: '/repo/src/even.ts',
      id: '/repo/src/even.ts',
      url: '/repo/src/even.ts',
      code: 'export const even = n => n % 2 === 0\n',
      map: sampleMap as any,
      invalidate: false,
    } as any)

    const round = await cache.getCachedModule(cachedFilePath)
    expect(round).toBeDefined()
    expect(round!.map).toEqual(sampleMap)
  })
})

test('cache round-trip keeps a `{ mappings: "" }` rollup sentinel map intact', async () => {
  // This is the case the original bug hit: the sentinel has no `version`, so
  // `inlineSourceMap` refused to embed it into the cached code, and on read
  // `extractSourceMap` (which only parses inlined data URIs) returned `null`.
  // With the explicit meta field, the sentinel survives unchanged.
  const sentinel = { mappings: '' } as const

  await withTmp(async (dir) => {
    const cache = makeCache()
    const cachedFilePath = join(dir, 'entry.js')

    await cache.saveCachedModule(cachedFilePath, {
      file: '/repo/src/even.ts',
      id: '/repo/src/even.ts',
      url: '/repo/src/even.ts',
      code: 'export const even = n => n % 2 === 0\n',
      map: sentinel as any,
      invalidate: false,
    } as any)

    const round = await cache.getCachedModule(cachedFilePath)
    expect(round).toBeDefined()
    expect(round!.map).toEqual(sentinel)
  })
})

test('cache round-trip keeps a missing map as null', async () => {
  // For results without a map (some plugin paths) we should still round-trip
  // cleanly. Restoring `null` is fine — the consumer (fetchModule.ts) falls
  // back to `extractSourceMap` and finally `{ mappings: '' }`.
  await withTmp(async (dir) => {
    const cache = makeCache()
    const cachedFilePath = join(dir, 'entry.js')

    await cache.saveCachedModule(cachedFilePath, {
      file: '/repo/src/even.ts',
      id: '/repo/src/even.ts',
      url: '/repo/src/even.ts',
      code: 'export const even = n => n % 2 === 0\n',
      map: null,
      invalidate: false,
    } as any)

    const round = await cache.getCachedModule(cachedFilePath)
    expect(round).toBeDefined()
    expect(round!.map ?? null).toBeNull()
  })
})
