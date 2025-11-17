import type { DevEnvironment, FetchResult } from 'vite'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { version as viteVersion } from 'vite'
import { Vitest } from '../core'
import { hash } from '../hash'

// TODO: keep track of stale cache somehow? maybe in a meta file?

/**
 * @experimental
 */
export class FileSystemModuleCache {
  private version = '1.0.0'
  private fsCacheRoots = new WeakMap<ResolvedConfig, string>()

  async clearCache(vitest: Vitest): Promise<void> {
    const defaultFsCache = join(tmpdir(), 'vitest')
    const fsCachePaths = vitest.projects.map((r) => {
      return r.config.experimental.fsModuleCachePath || defaultFsCache
    })
    const uniquePaths = Array.from(new Set(fsCachePaths))
    await Promise.all(
      uniquePaths.map(directory => rm(directory, { force: true, recursive: true })),
    )
    vitest.logger.log('[cache] cleared fs module cache at', uniquePaths.join(', '))
  }

  async getCachedModule(cachedFilePath: string): Promise<FetchResult | undefined> {
    if (!existsSync(cachedFilePath)) {
      return
    }

    const code = await readFile(cachedFilePath, 'utf-8')
    const matchIndex = code.lastIndexOf('\n//')
    if (matchIndex === -1) {
      return
    }

    const meta = JSON.parse(code.slice(matchIndex + 4))
    if (meta.externalize) {
      return { externalize: meta.externalize, type: meta.type }
    }

    return {
      id: meta.id,
      url: meta.url,
      file: meta.file,
      code,
      invalidate: false,
    }
  }

  async saveCachedModule<T extends FetchResult>(
    cachedFilePath: string,
    fetchResult: T,
  ): Promise<void> {
    // TODO: also keep dependencies, so they can populate the module graph on the next run

    if ('externalize' in fetchResult) {
      await atomicWriteFile(cachedFilePath, `\n// ${JSON.stringify(fetchResult)}`)
    }
    else if ('code' in fetchResult) {
      const result = {
        file: fetchResult.file,
        id: fetchResult.id,
        url: fetchResult.url,
        invalidate: false,
      } satisfies Omit<FetchResult, 'code'>
      await atomicWriteFile(cachedFilePath, `${fetchResult.code}\n// ${JSON.stringify(result)}`)
    }
  }

  getCachePath(
    vitestConfig: ResolvedConfig,
    environment: DevEnvironment,
    resolver: VitestResolver,
    id: string,
    fileContent: string,
  ): string {
    const config = environment.config
    const cacheConfig = JSON.stringify(
      {
        root: config.root,
        // at the moment, Vitest always forces base to be /
        base: config.base,
        mode: config.mode,
        consumer: config.consumer,
        resolve: config.resolve,
        // plugins can have different options, so this is not the best key,
        // but we canot access the options because there is no standard API for it
        plugins: config.plugins.map(p => p.name),
        environment: environment.name,
        // this affects Vitest CSS plugin
        css: vitestConfig.css,
        // this affect externalization
        resolver: resolver.options,
      },
      (_, value) => {
        if (typeof value === 'function' || value instanceof RegExp) {
          return value.toString()
        }
        return value
      },
    )
    const cacheKey = hash(
      'sha1',
      id
      + fileContent
      + (process.env.NODE_ENV ?? '')
      + this.version
      + cacheConfig
      + viteVersion
      + Vitest.version,
      'hex',
    )
    let cacheRoot = this.fsCacheRoots.get(vitestConfig)
    if (cacheRoot == null) {
      cacheRoot = vitestConfig.experimental.fsModuleCachePath || join(tmpdir(), 'vitest')
      if (!existsSync(cacheRoot)) {
        mkdirSync(cacheRoot, { recursive: true })
      }
    }
    return join(cacheRoot, cacheKey)
  }
}

/**
 * Performs an atomic write operation using the write-then-rename pattern.
 *
 * Why we need this:
 * - Ensures file integrity by never leaving partially written files on disk
 * - Prevents other processes from reading incomplete data during writes
 * - Particularly important for test files where incomplete writes could cause test failures
 *
 * The implementation writes to a temporary file first, then renames it to the target path.
 * This rename operation is atomic on most filesystems (including POSIX-compliant ones),
 * guaranteeing that other processes will only ever see the complete file.
 *
 * Added in https://github.com/vitest-dev/vitest/pull/7531
 */
async function atomicWriteFile(realFilePath: string, data: string): Promise<void> {
  const dir = dirname(realFilePath)
  const tmpFilePath = join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  try {
    await writeFile(tmpFilePath, data, 'utf-8')
    await rename(tmpFilePath, realFilePath)
  }
  finally {
    try {
      if (await stat(tmpFilePath)) {
        await unlink(tmpFilePath)
      }
    }
    catch {}
  }
}
