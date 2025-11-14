import type { DevEnvironment, FetchResult } from 'vite'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { Logger } from '../logger'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import crypto from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { version as viteVersion } from 'vite'
import { Vitest } from '../core'

/**
 * @experimental
 */
export class FileSystemModuleCache {
  private fsCacheRoot: string
  private version = '1.0.0'

  // TODO: keep track of stale cache somehow? maybe in a meta file?

  constructor(private logger: Logger) {
    this.fsCacheRoot = join(tmpdir(), 'vitest')

    if (!existsSync(this.fsCacheRoot)) {
      mkdirSync(this.fsCacheRoot)
    }
  }

  async clearCache(): Promise<void> {
    await rm(this.fsCacheRoot, { force: true, recursive: true })
    this.logger.log('[cache] cleared fs module cache at', this.fsCacheRoot)
  }

  async getCachedModule(
    cachedFilePath: string,
  ): Promise<FetchResult | FetchCachedFileSystemResult | undefined> {
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
    const viteConfig = JSON.stringify(
      {
        root: config.root,
        base: config.base,
        mode: config.mode,
        consumer: config.consumer,
        resolve: config.resolve,
        plugins: config.plugins.map(p => p.name),
        environment: environment.name,
        css: vitestConfig.css,
        resolver: resolver.options,
      },
      (_, value) => {
        if (typeof value === 'function' || value instanceof RegExp) {
          return value.toString()
        }
        return value
      },
    )
    const cacheKey = crypto.createHash('sha1')
      .update(id)
      .update(fileContent)
      .update(process.env.NODE_ENV ?? '')
      .update(this.version)
      .update(viteConfig)
      .update(viteVersion)
      .update(Vitest.version)
      .digest('hex')
    return join(this.fsCacheRoot, cacheKey)
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
