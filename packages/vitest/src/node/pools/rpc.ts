import type { DevEnvironment, FetchResult } from 'vite'
import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cleanUrl, isExternalUrl, unwrapId, withTrailingSlash, wrapId } from '@vitest/utils'
import { dirname, join } from 'pathe'
import { hash } from '../hash'

const created = new Set()
const promises = new Map<string, Promise<void>>()

interface MethodsOptions {
  cacheFs?: boolean
  // do not report files
  collect?: boolean
}

export function createMethodsRPC(project: TestProject, options: MethodsOptions = {}): RuntimeRPC {
  const ctx = project.vitest
  const cacheFs = options.cacheFs ?? false
  const cachedFsResults = new Map<string, string>()
  return {
    async fetch(
      url,
      importer,
      environmentName,
      options,
    ) {
      const environment = project.vite.environments[environmentName]
      if (!environment) {
        throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
      }

      if (url === '/@vite/client' || url === '@vite/client') {
        // this will be stubbed
        return { externalize: '/@vite/client', type: 'module' }
      }

      const isFileUrl = url.startsWith('file://')
      const willBeExternalizedByVite
        // is external fs module
        = (!isFileUrl && importer && url[0] !== '.' && url[0] !== '/')
        // data
          || url.startsWith('data:')
          || (isExternalUrl(url) && !isFileUrl)

      // We don't want to create a new module node if it will be externalized,
      // so we copy paste the Vite resolution logic.
      // In a perfect world we can execute our own cache related code inside fetchModule
      // or just NOT have our own externalization logic <-- pls
      if (!willBeExternalizedByVite) {
        const mod = await environment.moduleGraph.ensureEntryFromUrl(unwrapId(url))
        const cached = !!mod.transformResult

        // if url is already cached, we can just confirm it's also cached on the server
        if (options?.cached && cached) {
          return { cache: true }
        }

        if (mod.id) {
          const externalize = await project._resolver.shouldExternalize(mod.id)
          if (externalize) {
            return { externalize, type: 'module' }
          }
        }
      }

      const result = await environment.fetchModule(url, importer, options).catch(handleRollupError)

      if (!cacheFs || !('code' in result)) {
        return result
      }
      const code = result.code
      // to avoid serialising large chunks of code,
      // we store them in a tmp file and read in the test thread
      if (cachedFsResults.has(result.id)) {
        return getCachedResult(result, cachedFsResults)
      }
      const dir = join(project.tmpDir, environmentName)
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
    },
    async resolve(id, importer, environmentName) {
      const environment = project.vite.environments[environmentName]
      if (!environment) {
        throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
      }
      const resolved = await environment.pluginContainer.resolveId(id, importer)
      if (!resolved) {
        return null
      }
      return {
        file: cleanUrl(resolved.id),
        url: normalizeResolvedIdToUrl(environment, resolved.id),
        id: resolved.id,
      }
    },

    snapshotSaved(snapshot) {
      ctx.snapshot.add(snapshot)
    },
    resolveSnapshotPath(testPath: string) {
      return ctx.snapshot.resolvePath<ResolveSnapshotPathHandlerContext>(testPath, {
        config: project.serializedConfig,
      })
    },
    async transform(id) {
      const result = await project.vite.transformRequest(id).catch(handleRollupError)
      // TODO: this code should not be processed with ssrTransform (how?)
      return { code: result?.code }
    },
    async onQueued(file) {
      if (options.collect) {
        ctx.state.collectFiles(project, [file])
      }
      else {
        await ctx._testRun.enqueued(project, file)
      }
    },
    async onCollected(files) {
      if (options.collect) {
        ctx.state.collectFiles(project, files)
      }
      else {
        await ctx._testRun.collected(project, files)
      }
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    async onTaskAnnotate(testId, annotation) {
      return ctx._testRun.annotate(testId, annotation)
    },
    async onTaskUpdate(packs, events) {
      if (options.collect) {
        ctx.state.updateTasks(packs)
      }
      else {
        await ctx._testRun.updated(packs, events)
      }
    },
    async onUserConsoleLog(log) {
      if (options.collect) {
        ctx.state.updateUserLog(log)
      }
      else {
        await ctx._testRun.log(log)
      }
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onCancel(reason) {
      ctx.cancelCurrentRun(reason)
    },
    getCountOfFailedTests() {
      return ctx.state.getCountOfFailedTests()
    },
  }
}

function getCachedResult(result: Extract<FetchResult, { code: string }>, cachedFsResults: Map<string, string>) {
  const tmp = cachedFsResults.get(result.id)
  if (!tmp) {
    throw new Error(`The cached result was returned too early for ${result.id}.`)
  }
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

// TODO: have abstraction
// this is copy pasted from vite
function normalizeResolvedIdToUrl(
  environment: DevEnvironment,
  resolvedId: string,
): string {
  const root = environment.config.root
  const depsOptimizer = environment.depsOptimizer

  let url: string

  // normalize all imports into resolved URLs
  // e.g. `import 'foo'` -> `import '/@fs/.../node_modules/foo/index.js'`
  if (resolvedId.startsWith(withTrailingSlash(root))) {
    // in root: infer short absolute path from root
    url = resolvedId.slice(root.length)
  }
  else if (
    depsOptimizer?.isOptimizedDepFile(resolvedId)
    // vite-plugin-react isn't following the leading \0 virtual module convention.
    // This is a temporary hack to avoid expensive fs checks for React apps.
    // We'll remove this as soon we're able to fix the react plugins.
    || (resolvedId !== '/@react-refresh'
      && path.isAbsolute(resolvedId)
      && existsSync(cleanUrl(resolvedId)))
  ) {
    // an optimized deps may not yet exists in the filesystem, or
    // a regular file exists but is out of root: rewrite to absolute /@fs/ paths
    url = path.posix.join('/@fs/', resolvedId)
  }
  else {
    url = resolvedId
  }

  // if the resolved id is not a valid browser import specifier,
  // prefix it to make it valid. We will strip this before feeding it
  // back into the transform pipeline
  if (url[0] !== '.' && url[0] !== '/') {
    url = wrapId(resolvedId)
  }

  return url
}
