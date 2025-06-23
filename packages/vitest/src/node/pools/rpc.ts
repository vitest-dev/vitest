import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { mkdirSync } from 'node:fs'
import { rename, stat, unlink, writeFile } from 'node:fs/promises'
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
  return {
    snapshotSaved(snapshot) {
      ctx.snapshot.add(snapshot)
    },
    resolveSnapshotPath(testPath: string) {
      return ctx.snapshot.resolvePath<ResolveSnapshotPathHandlerContext>(testPath, {
        config: project.serializedConfig,
      })
    },
    async fetch(id, transformMode) {
      const result = await project.vitenode.fetchResult(id, transformMode).catch(handleRollupError)
      const code = result.code
      if (!cacheFs || result.externalize) {
        return result
      }
      if ('id' in result && typeof result.id === 'string') {
        return { id: result.id }
      }

      if (code == null) {
        throw new Error(`Failed to fetch module ${id}`)
      }

      const dir = join(project.tmpDir, transformMode)
      const name = hash('sha1', id, 'hex')
      const tmp = join(dir, name)
      if (!created.has(dir)) {
        mkdirSync(dir, { recursive: true })
        created.add(dir)
      }
      if (promises.has(tmp)) {
        await promises.get(tmp)
        return { id: tmp }
      }
      promises.set(
        tmp,

        atomicWriteFile(tmp, code)
        // Fallback to non-atomic write for windows case where file already exists:
          .catch(() => writeFile(tmp, code, 'utf-8'))
          .finally(() => promises.delete(tmp)),
      )
      await promises.get(tmp)
      Object.assign(result, { id: tmp })
      return { id: tmp }
    },
    resolveId(id, importer, transformMode) {
      return project.vitenode.resolveId(id, importer, transformMode).catch(handleRollupError)
    },
    transform(id, environment) {
      return project.vitenode.transformModule(id, environment).catch(handleRollupError)
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
