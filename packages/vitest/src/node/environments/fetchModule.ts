import type { Span } from '@opentelemetry/api'
import type { DevEnvironment, EnvironmentModuleNode, FetchResult, Rollup, TransformResult } from 'vite'
import type { FetchFunctionOptions } from 'vite/module-runner'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { OTELCarrier, Traces } from '../../utils/traces'
import type { FileSystemModuleCache } from '../cache/fsCache'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isExternalUrl, unwrapId } from '@vitest/utils/helpers'
import { join } from 'pathe'
import { fetchModule } from 'vite'
import { hash } from '../hash'

const saveCachePromises = new Map<string, Promise<FetchResult>>()
const readFilePromises = new Map<string, Promise<string | null>>()

class ModuleFetcher {
  private tmpDirectories = new Set<string>()
  private fsCacheEnabled: boolean

  constructor(
    private resolver: VitestResolver,
    private config: ResolvedConfig,
    private fsCache: FileSystemModuleCache,
    private traces: Traces,
    private tmpProjectDir: string,
  ) {
    this.fsCacheEnabled = config.experimental?.fsModuleCache === true
  }

  async fetch(
    trace: Span,
    url: string,
    importer: string | undefined,
    environment: DevEnvironment,
    makeTmpCopies?: boolean,
    options?: FetchFunctionOptions,
  ): Promise<FetchResult | FetchCachedFileSystemResult> {
    if (url.startsWith('data:')) {
      trace.setAttribute('vitest.module.external', url)
      return { externalize: url, type: 'builtin' }
    }

    if (url === '/@vite/client' || url === '@vite/client') {
      trace.setAttribute('vitest.module.external', url)
      return { externalize: '/@vite/client', type: 'module' }
    }

    const isFileUrl = url.startsWith('file://')

    if (isExternalUrl(url) && !isFileUrl) {
      trace.setAttribute('vitest.module.external', url)
      return { externalize: url, type: 'network' }
    }

    const moduleGraphModule = await environment.moduleGraph.ensureEntryFromUrl(unwrapId(url))
    const cached = !!moduleGraphModule.transformResult

    if (moduleGraphModule.file) {
      trace.setAttribute('code.file.path', moduleGraphModule.file)
    }

    if (options?.cached && cached) {
      return { cache: true }
    }

    // full fs caching is disabled, but we still want to keep tmp files if makeTmpCopies is enabled
    // this is primarily used by the forks pool to avoid using process.send(bigBuffer)
    if (!this.fsCacheEnabled) {
      const result = await this.fetchAndProcess(environment, url, importer, moduleGraphModule, options)

      this.recordResult(trace, result)

      if (!makeTmpCopies || !('code' in result)) {
        return result
      }

      const transformResult = moduleGraphModule.transformResult
      const tmpPath = transformResult && Reflect.get(transformResult, '_vitest_tmp')
      if (typeof tmpPath === 'string') {
        return getCachedResult(result, tmpPath)
      }

      const tmpDir = join(this.tmpProjectDir, environment.name)
      if (!this.tmpDirectories.has(tmpDir)) {
        if (!existsSync(tmpDir)) {
          mkdirSync(tmpDir, { recursive: true })
        }
        this.tmpDirectories.add(tmpDir)
      }

      const tmpFile = join(tmpDir, hash('sha1', result.id, 'hex'))
      return this.cacheResult(result, tmpFile).then((result) => {
        if (transformResult) {
          Reflect.set(transformResult, '_vitest_tmp', tmpFile)
        }
        return result
      })
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
      return saveCachePromises.get(cachePath)!.then((result) => {
        this.recordResult(trace, result)
        return result
      })
    }

    const cachedModule = await this.getCachedModule(cachePath, moduleGraphModule)
    if (cachedModule) {
      this.recordResult(trace, cachedModule)
      return cachedModule
    }

    const result = await this.fetchAndProcess(environment, url, importer, moduleGraphModule, options)

    return this.cacheResult(result, cachePath)
  }

  private recordResult(trace: Span, result: FetchResult | FetchCachedFileSystemResult): void {
    if ('externalize' in result) {
      trace.setAttributes({
        'vitest.module.external': result.externalize,
        'vitest.fetched_module.type': result.type,
      })
    }
    if ('id' in result) {
      trace.setAttributes({
        'vitest.fetched_module.invalidate': result.invalidate,
        'vitest.fetched_module.id': result.id,
        'vitest.fetched_module.url': result.url,
        'vitest.fetched_module.cache': false,
      })
      if (result.file) {
        trace.setAttribute('code.file.path', result.file)
      }
    }
    if ('code' in result) {
      trace.setAttribute('vitest.fetched_module.code_length', result.code.length)
    }
  }

  private async readFileContentToCache(
    environment: DevEnvironment,
    moduleGraphModule: EnvironmentModuleNode,
  ): Promise<string> {
    if (
      moduleGraphModule.file
      // \x00 is a virtual file convention
      && !moduleGraphModule.file.startsWith('\x00')
      && !moduleGraphModule.file.startsWith('virtual:')
    ) {
      const result = await this.readFileConcurrently(moduleGraphModule.file)
      if (result != null) {
        return result
      }
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

    if (cachedModule && 'code' in cachedModule) {
      // keep the module graph in sync
      if (!moduleGraphModule.transformResult) {
        const map = extractSourceMap(cachedModule.code)
        if (map && cachedModule.file) {
          map.file = cachedModule.file
        }
        moduleGraphModule.transformResult = { code: cachedModule.code, map }
      }
      return getCachedResult(cachedModule, cachePath)
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

  private readFileConcurrently(file: string): Promise<string | null> {
    if (!readFilePromises.has(file)) {
      readFilePromises.set(
        file,
        // virtual file can have a "file" property
        readFile(file, 'utf-8').catch(() => null).finally(() => {
          readFilePromises.delete(file)
        }),
      )
    }
    return readFilePromises.get(file)!
  }
}

export interface VitestFetchFunction {
  (
    url: string,
    importer: string | undefined,
    environment: DevEnvironment,
    cacheFs?: boolean,
    options?: FetchFunctionOptions,
    otelCarrier?: OTELCarrier
  ): Promise<FetchResult | FetchCachedFileSystemResult>
}

export function createFetchModuleFunction(
  resolver: VitestResolver,
  config: ResolvedConfig,
  fsCache: FileSystemModuleCache,
  traces: Traces,
  tmpProjectDir: string,
): VitestFetchFunction {
  const fetcher = new ModuleFetcher(resolver, config, fsCache, traces, tmpProjectDir)
  return async (url, importer, environment, cacheFs, options, otelCarrier) => {
    await traces.waitInit()
    const context = otelCarrier
      ? traces.getContextFromCarrier(otelCarrier)
      : undefined
    return traces.$(
      'vitest.module.transform',
      context
        ? { context }
        : {},
      span => fetcher.fetch(span, url, importer, environment, cacheFs, options),
    )
  }
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

const MODULE_RUNNER_SOURCEMAPPING_SOURCE = '//# sourceMappingSource=vite-generated'

function processResultSource(environment: DevEnvironment, result: FetchResult): FetchResult {
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
