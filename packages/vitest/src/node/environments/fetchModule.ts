import type { DevEnvironment, EnvironmentModuleNode, FetchResult, Rollup, TransformResult } from 'vite'
import type { FetchFunctionOptions } from 'vite/module-runner'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { FileSystemModuleCache } from '../cache/fsCache'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import { readFile } from 'node:fs/promises'
import { isExternalUrl, unwrapId } from '@vitest/utils/helpers'
import { fetchModule } from 'vite'

const saveCachePromises = new Map<string, Promise<FetchResult>>()
const readFilePromises = new Map<string, Promise<string>>()

class ModuleFetcher {
  constructor(
    private resolver: VitestResolver,
    private config: ResolvedConfig,
    private fsCache: FileSystemModuleCache,
  ) {}

  async fetch(
    url: string,
    importer: string | undefined,
    environment: DevEnvironment,
    cacheFs: boolean,
    options?: FetchFunctionOptions,
  ): Promise<FetchResult | FetchCachedFileSystemResult> {
    if (url.startsWith('data:')) {
      return { externalize: url, type: 'builtin' }
    }

    if (url === '/@vite/client' || url === '@vite/client') {
      return { externalize: '/@vite/client', type: 'module' }
    }

    const isFileUrl = url.startsWith('file://')

    if (isExternalUrl(url) && !isFileUrl) {
      return { externalize: url, type: 'network' }
    }

    const moduleGraphModule = await environment.moduleGraph.ensureEntryFromUrl(unwrapId(url))
    const cached = !!moduleGraphModule.transformResult

    if (options?.cached && cached) {
      return { cache: true }
    }

    // caching can be disabled on a project-per-project or file-per-file basis
    if (!cacheFs || !this.fsCache.isEnabled()) {
      return this.fetchAndProcess(environment, url, importer, moduleGraphModule, options)
    }

    const fileContent = await this.readFileContentToCache(environment, moduleGraphModule)
    const cachePath = this.fsCache.getCachePath(
      this.config,
      environment,
      this.resolver,
      moduleGraphModule.id!,
      fileContent,
    )

    if (saveCachePromises.has(cachePath)) {
      return saveCachePromises.get(cachePath)!
    }

    const cachedModule = await this.getCachedModule(cachePath, moduleGraphModule)
    if (cachedModule) {
      return cachedModule
    }

    const result = await this.fetchAndProcess(environment, url, importer, moduleGraphModule, options)

    return this.cacheResult(result, cachePath)
  }

  private async readFileContentToCache(
    environment: DevEnvironment,
    moduleGraphModule: EnvironmentModuleNode,
  ): Promise<string> {
    if (moduleGraphModule.file) {
      return this.readFileConcurrently(moduleGraphModule.file)
    }

    const loadResult = await environment.pluginContainer.load(moduleGraphModule.id!)
    if (typeof loadResult === 'string') {
      return loadResult
    }
    if (loadResult != null) {
      return loadResult.code
    }
    return ''
  }

  private async getCachedModule(
    cachePath: string,
    moduleGraphModule: EnvironmentModuleNode,
  ): Promise<FetchResult | FetchCachedFileSystemResult | undefined> {
    const cachedModule = await this.fsCache.getCachedModule(cachePath)

    if (cachedModule && 'tmp' in cachedModule) {
      // keep the module graph in sync
      if (!moduleGraphModule.transformResult) {
        const code = await readFile(cachedModule.tmp, 'utf-8')
        const map = extractSourceMap(code)
        if (map && cachedModule.file) {
          map.file = cachedModule.file
        }
        moduleGraphModule.transformResult = { code, map }
      }
    }

    return cachedModule
  }

  private async fetchAndProcess(
    environment: DevEnvironment,
    url: string,
    importer: string | undefined,
    moduleGraphModule: EnvironmentModuleNode,
    options?: FetchFunctionOptions,
  ): Promise<FetchResult> {
    const externalize = await this.resolver.shouldExternalize(moduleGraphModule.id!)
    if (externalize) {
      return { externalize, type: 'module' }
    }

    const moduleRunnerModule = await fetchModule(
      environment,
      url,
      importer,
      {
        ...options,
        inlineSourceMap: false,
      },
    ).catch(handleRollupError)

    return processResultSource(environment, moduleRunnerModule)
  }

  private async cacheResult(
    result: FetchResult,
    cachePath: string,
  ): Promise<FetchResult | FetchCachedFileSystemResult> {
    if (!this.fsCache.isEnabled()) {
      return result
    }

    const returnResult = 'code' in result
      ? getCachedResult(result, cachePath)
      : result

    if (saveCachePromises.has(cachePath)) {
      await saveCachePromises.get(cachePath)
      return returnResult
    }

    const savePromise = this.fsCache
      .saveCachedModule(cachePath, result)
      .then(() => result)
      .finally(() => {
        saveCachePromises.delete(cachePath)
      })

    saveCachePromises.set(cachePath, savePromise)
    await savePromise

    return returnResult
  }

  private readFileConcurrently(file: string): Promise<string> {
    if (!readFilePromises.has(file)) {
      readFilePromises.set(
        file,
        readFile(file, 'utf-8').finally(() => {
          readFilePromises.delete(file)
        }),
      )
    }
    return readFilePromises.get(file)!
  }
}

// interface DumpOptions {
//   dumpFolder?: string
//   readFromDump?: boolean
// }

export interface VitestFetchFunction {
  (
    url: string,
    importer: string | undefined,
    environment: DevEnvironment,
    cacheFs: boolean,
    options?: FetchFunctionOptions
  ): Promise<FetchResult | FetchCachedFileSystemResult>
}

export function createFetchModuleFunction(
  resolver: VitestResolver,
  config: ResolvedConfig,
  fsCache: FileSystemModuleCache,
): VitestFetchFunction {
  const fetcher = new ModuleFetcher(resolver, config, fsCache)
  return (url, importer, environment, cacheFs, options) =>
    fetcher.fetch(url, importer, environment, cacheFs, options)
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

const MODULE_RUNNER_SOURCEMAPPING_SOURCE = '//# sourceMappingSource=vite-generated'

function processResultSource(environment: DevEnvironment, result: FetchResult): FetchResult & {
  transformResult?: TransformResult | null
} {
  if (!('code' in result)) {
    return result
  }

  const node = environment.moduleGraph.getModuleById(result.id)
  if (node?.transformResult) {
    // this also overrides node.transformResult.code which is also what the module
    // runner does under the hood by default (we disable source maps inlining)
    inlineSourceMap(node.transformResult)
  }

  return {
    ...result,
    code: node?.transformResult?.code || result.code,
  }
}

const OTHER_SOURCE_MAP_REGEXP = new RegExp(
  `//# ${SOURCEMAPPING_URL}=data:application/json[^,]+base64,([A-Za-z0-9+/=]+)$`,
  'gm',
)

// we have to inline the source map ourselves, because
// - we don't need //# sourceURL since we are running code in VM
//   - important in stack traces and the V8 coverage
// - we need to inject an empty line for --inspect-brk
function inlineSourceMap(result: TransformResult) {
  const map = result.map
  let code = result.code

  if (
    !map
    || !('version' in map)
    || code.includes(MODULE_RUNNER_SOURCEMAPPING_SOURCE)
  ) {
    return result
  }

  // to reduce the payload size, we only inline vite node source map, because it's also the only one we use
  OTHER_SOURCE_MAP_REGEXP.lastIndex = 0
  if (OTHER_SOURCE_MAP_REGEXP.test(code)) {
    code = code.replace(OTHER_SOURCE_MAP_REGEXP, '')
  }

  const sourceMap = { ...map }

  // If the first line is not present on source maps, add simple 1:1 mapping ([0,0,0,0], [1,0,0,0])
  // so that debuggers can be set to break on first line
  if (sourceMap.mappings[0] === ';') {
    sourceMap.mappings = `AAAA,CAAA${sourceMap.mappings}`
  }

  result.code = `${code.trimEnd()}\n${
    MODULE_RUNNER_SOURCEMAPPING_SOURCE
  }\n//# ${SOURCEMAPPING_URL}=${genSourceMapUrl(sourceMap)}\n`

  return result
}

function genSourceMapUrl(map: Rollup.SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

function getCachedResult(result: Extract<FetchResult, { code: string }>, tmp: string): FetchCachedFileSystemResult {
  return {
    cached: true as const,
    file: result.file,
    id: result.id,
    tmp,
    url: result.url,
    invalidate: result.invalidate,
  }
}

const MODULE_RUNNER_SOURCEMAPPING_REGEXP = new RegExp(
  `//# ${SOURCEMAPPING_URL}=data:application/json;base64,(.+)`,
)

function extractSourceMap(code: string): null | Rollup.SourceMap {
  const pattern = `//# ${SOURCEMAPPING_URL}=data:application/json;base64,`
  const lastIndex = code.lastIndexOf(pattern)
  if (lastIndex === -1) {
    return null
  }

  const mapString = MODULE_RUNNER_SOURCEMAPPING_REGEXP.exec(
    code.slice(lastIndex),
  )?.[1]
  if (!mapString) {
    return null
  }
  return JSON.parse(Buffer.from(mapString, 'base64').toString('utf-8'))
}

// serialize rollup error on server to preserve details as a test error
export function handleRollupError(e: unknown): never {
  if (
    e instanceof Error
    && ('plugin' in e || 'frame' in e || 'id' in e)
  ) {
    // eslint-disable-next-line no-throw-literal
    throw {
      name: e.name,
      message: e.message,
      stack: e.stack,
      cause: e.cause,
      __vitest_rollup_error__: {
        plugin: (e as any).plugin,
        id: (e as any).id,
        loc: (e as any).loc,
        frame: (e as any).frame,
      },
    }
  }
  throw e
}
