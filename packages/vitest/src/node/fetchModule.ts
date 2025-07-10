import type { DevEnvironment, FetchModuleOptions, FetchResult } from 'vite'
import type { TestProject } from './project'
import { mkdirSync } from 'node:fs'
import { rename, stat, unlink, writeFile } from 'node:fs/promises'
import { isExternalUrl, unwrapId } from '@vitest/utils'
import { dirname, join } from 'pathe'
import { hash } from './hash'

const created = new Set()
const promises = new Map<string, Promise<void>>()
const cachedEnvironmentFsResults = new WeakMap<
  DevEnvironment,
  Map<string, string>
>()

export async function fetchModule(
  project: TestProject,
  url: string,
  importer: string,
  environment: DevEnvironment,
  options: FetchModuleOptions & {
    cacheFs?: boolean
  },
): Promise<FetchResult> {
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
  const module = await environment.moduleGraph.ensureEntryFromUrl(unwrapId(url))
  const cached = !!module.transformResult

  // if url is already cached, we can just confirm it's also cached on the server
  if (options?.cached && cached) {
    return { cache: true }
  }

  if (module.id) {
    const externalize = await project._resolver.shouldExternalize(module.id)
    if (externalize) {
      return { externalize, type: 'module' }
    }
  }

  const result = await environment.fetchModule(url, importer, options).catch(handleRollupError)

  if (!options.cacheFs || !('code' in result)) {
    return result
  }

  const code = result.code
  let cachedFsResults = cachedEnvironmentFsResults.get(environment)
  if (!cachedFsResults) {
    cachedFsResults = new Map()
    cachedEnvironmentFsResults.set(environment, cachedFsResults)
  }
  // to avoid serialising large chunks of code,
  // we store them in a tmp file and read in the test thread
  if (cachedFsResults.has(result.id)) {
    return getCachedResult(result, cachedFsResults)
  }
  const dir = join(project.tmpDir, environment.name)
  const name = hash('sha1', result.id, 'hex')
  const tmp = join(dir, name)
  if (!created.has(dir)) {
    mkdirSync(dir, { recursive: true })
    created.add(dir)
  }
  if (promises.has(tmp)) {
    await promises.get(tmp)
    cachedFsResults.set(result.id, tmp)
    return getCachedResult(result, cachedFsResults)
  }
  promises.set(
    tmp,

    atomicWriteFile(tmp, code)
    // Fallback to non-atomic write for windows case where file already exists:
      .catch(() => writeFile(tmp, code, 'utf-8'))
      .finally(() => promises.delete(tmp)),
  )
  await promises.get(tmp)
  cachedFsResults.set(result.id, tmp)
  return getCachedResult(result, cachedFsResults)
}

// serialize rollup error on server to preserve details as a test error
function handleRollupError(e: unknown): never {
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

function getCachedResult(result: Extract<FetchResult, { code: string }>, cachedFsResults: Map<string, string>) {
  const tmp = cachedFsResults.get(result.id)
  if (!tmp) {
    throw new Error(`The cached result was returned too early for ${result.id}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }
  return {
    cached: true as const,
    file: result.file,
    id: result.id,
    tmp,
    url: result.url,
    invalidate: result.invalidate,
  } as any as FetchResult
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
