import type { RawSourceMap } from 'vite-node'
import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
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
    async getSourceMap(id, force) {
      if (force) {
        const mod = project.vite.moduleGraph.getModuleById(id)
        if (mod) {
          project.vite.moduleGraph.invalidateModule(mod)
        }
      }
      const r = await project.vitenode.transformRequest(id)
      return r?.map as RawSourceMap | undefined
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
      if (promises.has(tmp)) {
        await promises.get(tmp)
        return { id: tmp }
      }
      if (!created.has(dir)) {
        await mkdir(dir, { recursive: true })
        created.add(dir)
      }
      promises.set(
        tmp,
        writeFile(tmp, code, 'utf-8').finally(() => promises.delete(tmp)),
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
