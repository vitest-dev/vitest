import type { DevEnvironment, FetchResult } from 'vite'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { parse, stringify } from 'flatted'
import { dirname, join } from 'pathe'
import c from 'tinyrainbow'
import { version as viteVersion } from 'vite'
import { createDebugger } from '../../utils/debugger'
import { Vitest } from '../core'
import { hash } from '../hash'

const debugFs = createDebugger('vitest:cache:fs')
const debugMemory = createDebugger('vitest:cache:memory')

const cacheComment = '\n//# vitestCache='
const cacheCommentLength = cacheComment.length

// TODO: keep track of stale cache somehow? maybe in a meta file?

/**
 * @experimental
 */
export class FileSystemModuleCache {
  private version = '1.0.0'
  private fsCacheRoots = new WeakMap<ResolvedConfig, string>()
  private fsEnvironmentHashMap = new WeakMap<DevEnvironment, string>()
  private fsCacheKeyGenerators = new Set<CacheKeyIdGenerator>()
  // this exists only to avoid the perf. cost of reading a file and generating a hash again
  // on some machines this has negligible effect
  private fsCacheKeys = new WeakMap<
    DevEnvironment,
    // Map<id, tmp>
    Map<string, string>
  >()

  constructor(private vitest: Vitest) {}

  public defineCacheKeyGenerator(callback: CacheKeyIdGenerator): void {
    this.fsCacheKeyGenerators.add(callback)
  }

  async clearCache(): Promise<void> {
    const defaultFsCache = join(tmpdir(), 'vitest')
    const fsCachePaths = this.vitest.projects.map((r) => {
      return r.config.experimental.fsModuleCachePath || defaultFsCache
    })
    const uniquePaths = Array.from(new Set(fsCachePaths))
    await Promise.all(
      uniquePaths.map(directory => rm(directory, { force: true, recursive: true })),
    )
    this.vitest.logger.log('[cache] cleared fs module cache at', uniquePaths.join(', '))
  }

  async getCachedModule(cachedFilePath: string): Promise<
    CachedInlineModuleMeta
    | Extract<FetchResult, { externalize: string }>
    | undefined
  > {
    if (!existsSync(cachedFilePath)) {
      debugFs?.(`${c.red('[empty]')} ${cachedFilePath} doesn't exist, transforming by vite instead`)
      return
    }

    const code = await readFile(cachedFilePath, 'utf-8')
    const matchIndex = code.lastIndexOf(cacheComment)
    if (matchIndex === -1) {
      debugFs?.(`${c.red('[empty]')} ${cachedFilePath} exists, but doesn't have a ${cacheComment} comment, transforming by vite instead`)
      return
    }

    const meta = this.fromBase64(code.slice(matchIndex + cacheCommentLength))
    if (meta.externalize) {
      debugFs?.(`${c.green('[read]')} ${meta.externalize} is externalized inside ${cachedFilePath}`)
      return { externalize: meta.externalize, type: meta.type }
    }
    debugFs?.(`${c.green('[read]')} ${meta.id} is cached in ${cachedFilePath}`)

    return {
      id: meta.id,
      url: meta.url,
      file: meta.file,
      code,
      importers: meta.importers,
      mappings: meta.mappings,
    }
  }

  async saveCachedModule<T extends FetchResult>(
    cachedFilePath: string,
    fetchResult: T,
    importers: string[] = [],
    mappings: boolean = false,
  ): Promise<void> {
    if ('externalize' in fetchResult) {
      debugFs?.(`${c.yellow('[write]')} ${fetchResult.externalize} is externalized inside ${cachedFilePath}`)
      await atomicWriteFile(cachedFilePath, `${cacheComment}${this.toBase64(fetchResult)}`)
    }
    else if ('code' in fetchResult) {
      const result = {
        file: fetchResult.file,
        id: fetchResult.id,
        url: fetchResult.url,
        importers,
        mappings,
      } satisfies Omit<FetchResult, 'code' | 'invalidate'>
      debugFs?.(`${c.yellow('[write]')} ${fetchResult.id} is cached in ${cachedFilePath}`)
      await atomicWriteFile(cachedFilePath, `${fetchResult.code}${cacheComment}${this.toBase64(result)}`)
    }
  }

  private toBase64(obj: unknown) {
    const json = stringify(obj)
    return Buffer.from(json).toString('base64')
  }

  private fromBase64(obj: string) {
    const json = Buffer.from(obj, 'base64').toString('utf-8')
    return parse(json)
  }

  invalidateCachePath(
    environment: DevEnvironment,
    id: string,
  ): void {
    debugFs?.(`cache for ${id} in ${environment.name} environment is invalidated`)
    this.fsCacheKeys.get(environment)?.delete(id)
  }

  invalidateAllCachePaths(environment: DevEnvironment): void {
    debugFs?.(`the ${environment.name} environment cache is invalidated`)
    this.fsCacheKeys.get(environment)?.clear()
  }

  getMemoryCachePath(
    environment: DevEnvironment,
    id: string,
  ): string | undefined {
    const result = this.fsCacheKeys.get(environment)?.get(id)
    if (result) {
      debugMemory?.(`${c.green('[write]')} ${id} was cached in ${result}`)
    }
    return result
  }

  generateCachePath(
    vitestConfig: ResolvedConfig,
    environment: DevEnvironment,
    resolver: VitestResolver,
    id: string,
    fileContent: string,
  ): string {
    const config = environment.config
    // coverage provider is dynamic, so we also clear the whole cache if
    // vitest.enableCoverage/vitest.disableCoverage is called
    const coverageAffectsCache = String(this.vitest.config.coverage.enabled && this.vitest.coverageProvider?.requiresTransform?.(id))
    let cacheConfig = this.fsEnvironmentHashMap.get(environment)
    if (!cacheConfig) {
      cacheConfig = JSON.stringify(
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
          resolver: {
            inline: resolver.options.inline,
            external: resolver.options.external,
            inlineFiles: resolver.options.inlineFiles,
            moduleDirectories: resolver.options.moduleDirectories,
          },
        },
        (_, value) => {
          if (typeof value === 'function' || value instanceof RegExp) {
            return value.toString()
          }
          return value
        },
      )
      this.fsEnvironmentHashMap.set(environment, cacheConfig)
    }

    let hashString = id
      + fileContent
      + (process.env.NODE_ENV ?? '')
      + this.version
      + cacheConfig
      + coverageAffectsCache
      + viteVersion
      + Vitest.version

    this.fsCacheKeyGenerators.forEach((generator) => {
      const result = generator(environment, id, fileContent)
      if (typeof result === 'string') {
        hashString += result
      }
    })

    const cacheKey = hash('sha1', hashString, 'hex')

    let cacheRoot = this.fsCacheRoots.get(vitestConfig)
    if (cacheRoot == null) {
      cacheRoot = vitestConfig.experimental.fsModuleCachePath || join(tmpdir(), 'vitest')
      if (!existsSync(cacheRoot)) {
        mkdirSync(cacheRoot, { recursive: true })
      }
    }

    let environmentKeys = this.fsCacheKeys.get(environment)
    if (!environmentKeys) {
      environmentKeys = new Map()
      this.fsCacheKeys.set(environment, environmentKeys)
    }

    const fsResultPath = join(cacheRoot, cacheKey)
    debugMemory?.(`${c.yellow('[write]')} ${id} generated a cache in ${fsResultPath}`)
    environmentKeys.set(id, fsResultPath)
    return fsResultPath
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

export interface CachedInlineModuleMeta {
  url: string
  id: string
  file: string | null
  code: string
  importers: string[]
  mappings: boolean
}

export interface CacheKeyIdGenerator {
  (
    environment: DevEnvironment,
    id: string,
    sourceCode: string,
  ): string | undefined | null
}
