import type { DevEnvironment, FetchResult } from 'vite'
import type { Vitest } from '../core'
import type { ResolvedConfig } from '../types/config'
import fs, { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'flatted'
import { dirname, join } from 'pathe'
import c from 'tinyrainbow'
import { searchForWorkspaceRoot } from 'vite'
import { createDebugger } from '../../utils/debugger'
import { hash } from '../hash'

const debugFs = createDebugger('vitest:cache:fs')
const debugMemory = createDebugger('vitest:cache:memory')

const cacheComment = '\n//# vitestCache='
const cacheCommentLength = cacheComment.length

const METADATA_FILE = '_metadata.json'

const parallelFsCacheRead = new Map<string, Promise<{ code: string; meta: CachedInlineModuleMeta } | undefined>>()

/**
 * @experimental
 */
export class FileSystemModuleCache {
  /**
   * Even though it's possible to override the folder of project's caches
   * We still keep a single metadata file for all projects because
   * - they can reference files between each other
   * - lockfile changes are reflected for the whole workspace, not just for a single project
   */
  private rootCache: string
  private metadataFilePath: string

  private version = '1.0.0-beta.4'
  private fsCacheRoots = new WeakMap<ResolvedConfig, string>()
  private fsEnvironmentHashMap = new WeakMap<DevEnvironment, string>()
  private fsCacheKeyGenerators = new Set<CacheKeyIdGenerator>()
  // this exists only to avoid the perf. cost of reading a file and generating a hash again
  // surprisingly, on some machines this has negligible effect
  private fsCacheKeys = new WeakMap<
    DevEnvironment,
    // Map<id, tmp | null>
    Map<string, string | null>
  >()

  constructor(private vitest: Vitest) {
    const workspaceRoot = searchForWorkspaceRoot(vitest.vite.config.root)
    this.rootCache = vitest.config.experimental.fsModuleCachePath
      || join(workspaceRoot, 'node_modules', '.experimental-vitest-cache')
    this.metadataFilePath = join(this.rootCache, METADATA_FILE)
  }

  public defineCacheKeyGenerator(callback: CacheKeyIdGenerator): void {
    this.fsCacheKeyGenerators.add(callback)
  }

  async clearCache(log = true): Promise<void> {
    const fsCachePaths = this.vitest.projects.map((r) => {
      return r.config.experimental.fsModuleCachePath || this.rootCache
    })
    const uniquePaths = Array.from(new Set(fsCachePaths))
    await Promise.all(
      uniquePaths.map(directory => rm(directory, { force: true, recursive: true })),
    )
    if (log) {
      this.vitest.logger.log(`[cache] cleared fs module cache at ${uniquePaths.join(', ')}`)
    }
  }

  private readCachedFileConcurrently(cachedFilePath: string) {
    if (!parallelFsCacheRead.has(cachedFilePath)) {
      parallelFsCacheRead.set(cachedFilePath, readFile(cachedFilePath, 'utf-8').then((code) => {
        const matchIndex = code.lastIndexOf(cacheComment)
        if (matchIndex === -1) {
          debugFs?.(`${c.red('[empty]')} ${cachedFilePath} exists, but doesn't have a ${cacheComment} comment, transforming by vite instead`)
          return
        }

        return { code, meta: this.fromBase64(code.slice(matchIndex + cacheCommentLength)) }
      }).finally(() => {
        parallelFsCacheRead.delete(cachedFilePath)
      }))
    }
    return parallelFsCacheRead.get(cachedFilePath)!
  }

  async getCachedModule(cachedFilePath: string): Promise<
    CachedInlineModuleMeta
    | undefined
  > {
    if (!existsSync(cachedFilePath)) {
      debugFs?.(`${c.red('[empty]')} ${cachedFilePath} doesn't exist, transforming by vite first`)
      return
    }

    const fileResult = await this.readCachedFileConcurrently(cachedFilePath)
    if (!fileResult) {
      return
    }
    const { code, meta } = fileResult

    debugFs?.(`${c.green('[read]')} ${meta.id} is cached in ${cachedFilePath}`)

    return {
      id: meta.id,
      url: meta.url,
      file: meta.file,
      code,
      importedUrls: meta.importedUrls,
      mappings: meta.mappings,
    }
  }

  async saveCachedModule<T extends FetchResult>(
    cachedFilePath: string,
    fetchResult: T,
    importedUrls: string[] = [],
    mappings: boolean = false,
  ): Promise<void> {
    if ('code' in fetchResult) {
      const result = {
        file: fetchResult.file,
        id: fetchResult.id,
        url: fetchResult.url,
        importedUrls,
        mappings,
      } satisfies Omit<CachedInlineModuleMeta, 'code'>
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
  ): string | null | undefined {
    const result = this.fsCacheKeys.get(environment)?.get(id)
    if (result != null) {
      debugMemory?.(`${c.green('[read]')} ${id} was cached in ${result}`)
    }
    else if (result === null) {
      debugMemory?.(`${c.green('[read]')} ${id} was bailed out`)
    }
    return result
  }

  generateCachePath(
    vitestConfig: ResolvedConfig,
    environment: DevEnvironment,
    id: string,
    fileContent: string,
  ): string | null {
    // bail out if file has import.meta.glob because it depends on other files
    // TODO: figure out a way to still support it
    if (fileContent.includes('import.meta.glob(')) {
      this.saveMemoryCache(environment, id, null)
      debugMemory?.(`${c.yellow('[write]')} ${id} was bailed out because it has "import.meta.glob"`)
      return null
    }

    let hashString = ''

    for (const generator of this.fsCacheKeyGenerators) {
      const result = generator({ environment, id, sourceCode: fileContent })
      if (typeof result === 'string') {
        hashString += result
      }
      if (result === false) {
        this.saveMemoryCache(environment, id, null)
        debugMemory?.(`${c.yellow('[write]')} ${id} was bailed out by a custom generator`)
        return null
      }
    }

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
          plugins: config.plugins
            .filter(p => p.api?.vitest?.experimental?.ignoreFsModuleCache !== true)
            .map(p => p.name),
          // in case local plugins change
          // configFileDependencies also includes configFile
          configFileDependencies: config.configFileDependencies.map(file => tryReadFileSync(file)),
          environment: environment.name,
          // this affects Vitest CSS plugin
          css: vitestConfig.css,
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

    hashString += id
      + fileContent
      + (process.env.NODE_ENV ?? '')
      + this.version
      + cacheConfig
      + coverageAffectsCache

    const cacheKey = hash('sha1', hashString, 'hex')

    let cacheRoot = this.fsCacheRoots.get(vitestConfig)
    if (cacheRoot == null) {
      cacheRoot = vitestConfig.experimental.fsModuleCachePath || this.rootCache
      this.fsCacheRoots.set(vitestConfig, cacheRoot)
      if (!existsSync(cacheRoot)) {
        mkdirSync(cacheRoot, { recursive: true })
      }
    }

    const fsResultPath = join(cacheRoot, cacheKey)
    debugMemory?.(`${c.yellow('[write]')} ${id} generated a cache in ${fsResultPath}`)
    this.saveMemoryCache(environment, id, fsResultPath)
    return fsResultPath
  }

  private saveMemoryCache(environment: DevEnvironment, id: string, cache: string | null) {
    let environmentKeys = this.fsCacheKeys.get(environment)
    if (!environmentKeys) {
      environmentKeys = new Map()
      this.fsCacheKeys.set(environment, environmentKeys)
    }
    environmentKeys.set(id, cache)
  }

  private async readMetadata(): Promise<{ lockfileHash: string } | undefined> {
    // metadata is shared between every projects in the workspace, so we ignore project's fsModuleCachePath
    if (!existsSync(this.metadataFilePath)) {
      return undefined
    }
    try {
      const content = await readFile(this.metadataFilePath, 'utf-8')
      return JSON.parse(content)
    }
    catch {}
  }

  // before vitest starts running tests, we check that the lockfile wasn't updated
  // if it was, we nuke the previous cache in case a custom plugin was updated
  // or a new version of vite/vitest is installed
  // for the same reason we also cache config file content, but that won't catch changes made in external plugins
  public async ensureCacheIntegrity(): Promise<void> {
    const enabled = [
      this.vitest.getRootProject(),
      ...this.vitest.projects,
    ].some(p => p.config.experimental.fsModuleCache)
    if (!enabled) {
      return
    }

    const metadata = await this.readMetadata()
    const currentLockfileHash = getLockfileHash(this.vitest.vite.config.root)

    // no metadata found, just store a new one, don't reset the cache
    if (!metadata) {
      if (!existsSync(this.rootCache)) {
        mkdirSync(this.rootCache, { recursive: true })
      }
      debugFs?.(`fs metadata file was created with hash ${currentLockfileHash}`)

      await writeFile(
        this.metadataFilePath,
        JSON.stringify({ lockfileHash: currentLockfileHash }, null, 2),
        'utf-8',
      )
      return
    }

    // if lockfile didn't change, don't do anything
    if (metadata.lockfileHash === currentLockfileHash) {
      return
    }

    // lockfile changed, let's clear all caches
    await this.clearCache(false)
    this.vitest.vite.config.logger.info(
      `fs cache was cleared because lockfile has changed`,
      {
        timestamp: true,
        environment: c.yellow('[vitest]'),
      },
    )
    debugFs?.(`fs cache was cleared because lockfile has changed`)
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
  mappings: boolean
  importedUrls: string[]
}

/**
 * Generate a unique cache identifier.
 *
 * Return `false` to disable caching of the file.
 * @experimental
 */
export interface CacheKeyIdGenerator {
  (context: CacheKeyIdGeneratorContext): string | undefined | null | false
}

/**
 * @experimental
 */
export interface CacheKeyIdGeneratorContext {
  environment: DevEnvironment
  id: string
  sourceCode: string
}

// lockfile hash resolution taken from vite
// since this is experimental, we don't ask to expose it
const lockfileFormats = [
  {
    path: 'node_modules/.package-lock.json',
    checkPatchesDir: 'patches',
    manager: 'npm',
  },
  {
    // Yarn non-PnP
    path: 'node_modules/.yarn-state.yml',
    checkPatchesDir: false,
    manager: 'yarn',
  },
  {
    // Yarn v3+ PnP
    path: '.pnp.cjs',
    checkPatchesDir: '.yarn/patches',
    manager: 'yarn',
  },
  {
    // Yarn v2 PnP
    path: '.pnp.js',
    checkPatchesDir: '.yarn/patches',
    manager: 'yarn',
  },
  {
    // yarn 1
    path: 'node_modules/.yarn-integrity',
    checkPatchesDir: 'patches',
    manager: 'yarn',
  },
  {
    path: 'node_modules/.pnpm/lock.yaml',
    // Included in lockfile
    checkPatchesDir: false,
    manager: 'pnpm',
  },
  {
    path: '.rush/temp/shrinkwrap-deps.json',
    // Included in lockfile
    checkPatchesDir: false,
    manager: 'pnpm',
  },
  {
    path: 'bun.lock',
    checkPatchesDir: 'patches',
    manager: 'bun',
  },
  {
    path: 'bun.lockb',
    checkPatchesDir: 'patches',
    manager: 'bun',
  },
].sort((_, { manager }) => {
  return process.env.npm_config_user_agent?.startsWith(manager) ? 1 : -1
})
const lockfilePaths = lockfileFormats.map(l => l.path)

function getLockfileHash(root: string): string {
  const lockfilePath = lookupFile(root, lockfilePaths)
  let content = lockfilePath ? fs.readFileSync(lockfilePath, 'utf-8') : ''
  if (lockfilePath) {
    const normalizedLockfilePath = lockfilePath.replaceAll('\\', '/')
    const lockfileFormat = lockfileFormats.find(f =>
      normalizedLockfilePath.endsWith(f.path),
    )!
    if (lockfileFormat.checkPatchesDir) {
      // Default of https://github.com/ds300/patch-package
      const baseDir = lockfilePath.slice(0, -lockfileFormat.path.length)
      const fullPath = join(
        baseDir,
        lockfileFormat.checkPatchesDir as string,
      )
      const stat = tryStatSync(fullPath)
      if (stat?.isDirectory()) {
        content += stat.mtimeMs.toString()
      }
    }
  }
  return hash('sha256', content, 'hex').substring(0, 8).padEnd(8, '_')
}

function lookupFile(
  dir: string,
  fileNames: string[],
): string | undefined {
  while (dir) {
    for (const fileName of fileNames) {
      const fullPath = join(dir, fileName)
      if (tryStatSync(fullPath)?.isFile()) {
        return fullPath
      }
    }
    const parentDir = dirname(dir)
    if (parentDir === dir) {
      return
    }

    dir = parentDir
  }
}

function tryReadFileSync(file: string): string {
  try {
    return readFileSync(file, 'utf-8')
  }
  catch {
    return ''
  }
}

function tryStatSync(file: string): fs.Stats | undefined {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    return fs.statSync(file, { throwIfNoEntry: false })
  }
  catch {
    // Ignore errors
  }
}
