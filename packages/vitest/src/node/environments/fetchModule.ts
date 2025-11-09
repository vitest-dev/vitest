import type { DevEnvironment, FetchResult, Rollup, TransformResult } from 'vite'
import type { FetchFunctionOptions } from 'vite/module-runner'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { VitestResolver } from '../resolver'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isExternalUrl, nanoid, unwrapId } from '@vitest/utils/helpers'
import { dirname, join, resolve } from 'pathe'
import { fetchModule } from 'vite'
import { hash } from '../hash'

const created = new Set()
const promises = new Map<string, Promise<void>>()

interface DumpOptions {
  dumpFolder?: string
  readFromDump?: boolean
}

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
  tmpDir: string = join(tmpdir(), nanoid()),
  dump?: DumpOptions,
): VitestFetchFunction {
  return async (
    url,
    importer,
    environment,
    cacheFs,
    options,
  ) => {
    // We are copy pasting Vite's externalization logic from `fetchModule` because
    // we instead rely on our own `shouldExternalize` method because Vite
    // doesn't support `resolve.external` in non SSR environments (jsdom/happy-dom)
    if (url.startsWith('data:')) {
      return { externalize: url, type: 'builtin' }
    }

    if (url === '/@vite/client' || url === '@vite/client') {
      // this will be stubbed
      return { externalize: '/@vite/client', type: 'module' }
    }

    const isFileUrl = url.startsWith('file://')

    if (isExternalUrl(url) && !isFileUrl) {
      return { externalize: url, type: 'network' }
    }

    // Vite does the same in `fetchModule`, but we want to externalize modules ourselves,
    // so we do this first to resolve the module and check its `id`. The next call of
    // `ensureEntryFromUrl` inside `fetchModule` is cached and should take no time
    // This also makes it so externalized modules are inside the module graph.
    const moduleGraphModule = await environment.moduleGraph.ensureEntryFromUrl(unwrapId(url))
    const cached = !!moduleGraphModule.transformResult

    // if url is already cached, we can just confirm it's also cached on the server
    if (options?.cached && cached) {
      return { cache: true }
    }

    if (moduleGraphModule.id) {
      const externalize = await resolver.shouldExternalize(moduleGraphModule.id)
      if (externalize) {
        return { externalize, type: 'module' }
      }
    }

    let moduleRunnerModule: FetchResult | undefined

    if (dump?.dumpFolder && dump.readFromDump) {
      const path = resolve(dump?.dumpFolder, url.replace(/[^\w+]/g, '-'))
      if (existsSync(path)) {
        const code = await readFile(path, 'utf-8')
        const matchIndex = code.lastIndexOf('\n//')
        if (matchIndex !== -1) {
          const { id, file } = JSON.parse(code.slice(matchIndex + 4))
          moduleRunnerModule = {
            code,
            id,
            url,
            file,
            invalidate: false,
          }
        }
      }
    }

    if (!moduleRunnerModule) {
      moduleRunnerModule = await fetchModule(
        environment,
        url,
        importer,
        {
          ...options,
          inlineSourceMap: false,
        },
      ).catch(handleRollupError)
    }

    const result = processResultSource(environment, moduleRunnerModule)

    if (dump?.dumpFolder && 'code' in result) {
      const path = resolve(dump?.dumpFolder, result.url.replace(/[^\w+]/g, '-'))
      await writeFile(path, `${result.code}\n// ${JSON.stringify({ id: result.id, file: result.file })}`, 'utf-8')
    }

    if (!cacheFs || !('code' in result)) {
      return result
    }

    const code = result.code
    const transformResult = result.transformResult!
    if (!transformResult) {
      throw new Error(`"transformResult" in not defined. This is a bug in Vitest.`)
    }
    // to avoid serialising large chunks of code,
    // we store them in a tmp file and read in the test thread
    if ('_vitestTmp' in transformResult) {
      return getCachedResult(result, Reflect.get(transformResult as any, '_vitestTmp'))
    }
    const dir = join(tmpDir, environment.name)
    const name = hash('sha1', result.id, 'hex')
    const tmp = join(dir, name)
    if (!created.has(dir)) {
      mkdirSync(dir, { recursive: true })
      created.add(dir)
    }
    if (promises.has(tmp)) {
      await promises.get(tmp)
      return getCachedResult(result, tmp)
    }
    promises.set(
      tmp,

      atomicWriteFile(tmp, code)
        // Fallback to non-atomic write for windows case where file already exists:
        .catch(() => writeFile(tmp, code, 'utf-8'))
        .finally(() => {
          Reflect.set(transformResult, '_vitestTmp', tmp)
          promises.delete(tmp)
        }),
    )
    await promises.get(tmp)
    return getCachedResult(result, tmp)
  }
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
    transformResult: node?.transformResult,
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
