import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import type { RawSourceMap } from 'vite-node'
import { join } from 'pathe'
import type { WorkspaceProject } from '../workspace'
import type { RuntimeRPC } from '../../types/rpc'

const created = new Set()
const promises = new Map<string, Promise<void>>()

interface MethodsOptions {
  cacheFs?: boolean
}

export function createMethodsRPC(project: WorkspaceProject, options: MethodsOptions = {}): RuntimeRPC {
  const ctx = project.ctx
  const cacheFs = options.cacheFs ?? false
  return {
    snapshotSaved(snapshot) {
      ctx.snapshot.add(snapshot)
    },
    resolveSnapshotPath(testPath: string) {
      return ctx.snapshot.resolvePath(testPath)
    },
    async getSourceMap(id, force) {
      if (force) {
        const mod = project.server.moduleGraph.getModuleById(id)
        if (mod) {
          project.server.moduleGraph.invalidateModule(mod)
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
      const name = createHash('sha1').update(id).digest('hex')
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
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      return ctx.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(project, files)
      return ctx.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      return ctx.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      ctx.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      return ctx.report('onFinished', files, ctx.state.getUnhandledErrors())
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
  if (e instanceof Error && 'plugin' in e) {
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
