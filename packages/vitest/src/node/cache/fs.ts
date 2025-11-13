import type { DevEnvironment, FetchResult } from 'vite'
import type { FetchCachedFileSystemResult } from '../../types/general'
import crypto from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { version as viteVersion } from 'vite'

/**
 * @experimental
 */
export class FileSystemModuleCache {
  private fsCacheRoot: string

  constructor(fsCacheKey: string) {
    this.fsCacheRoot = join(tmpdir(), fsCacheKey)

    if (!existsSync(this.fsCacheRoot)) {
      mkdirSync(this.fsCacheRoot)
    }
  }

  async getCachedModule(
    environment: DevEnvironment,
    id: string,
  ): Promise<FetchResult | FetchCachedFileSystemResult | undefined> {
    const cachedFilePath = this.getCachePath(environment, id)

    if (!existsSync(cachedFilePath)) {
      return
    }

    const content = await readFile(cachedFilePath, 'utf-8')
    const matchIndex = content.lastIndexOf('\n//')
    if (matchIndex === -1) {
      return
    }

    const meta = JSON.parse(content.slice(matchIndex + 4))
    if (meta.externalize) {
      return { externalize: meta.externalize, type: meta.type }
    }

    return {
      id: meta.id,
      url: meta.url,
      file: meta.file,
      // TODO: if fsCache is false, return with `code`
      tmp: cachedFilePath,
      cached: true,
      invalidate: false,
    }
  }

  async saveCachedModule<T extends FetchResult>(
    environment: DevEnvironment,
    id: string,
    fetchResult: T,
  ): Promise<void> {
    const cachedFilePath = this.getCachePath(environment, id)
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

  getCachePath(environment: DevEnvironment, id: string): string {
    const config = environment.config
    // TODO: more dynamic options
    const viteConfig = JSON.stringify(
      {
        root: config.root,
        resolve: config.resolve,
        plugins: config.plugins.map(p => p.name),
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
      .update(process.env.NODE_ENV ?? '')
      .update(viteVersion)
      .update(viteConfig)
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
