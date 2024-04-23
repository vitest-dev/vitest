import { mkdir, writeFile } from 'node:fs/promises'
import type { RawSourceMap } from 'vite-node'
import { join } from 'pathe'
import type { RuntimeRPC } from '../../types'
import type { WorkspaceProject } from '../workspace'

const created = new Set()
const promises = new Map<string, Promise<void>>()

export function createMethodsRPC(project: WorkspaceProject): RuntimeRPC {
  const ctx = project.ctx
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
        if (mod)
          project.server.moduleGraph.invalidateModule(mod)
      }
      const r = await project.vitenode.transformRequest(id)
      return r?.map as RawSourceMap | undefined
    },
    async fetch(id, transformMode) {
      const result = await project.vitenode.fetchResult(id, transformMode)
      if (result.externalize)
        return result
      if (!result.code && 'id' in result)
        return { id: result.id as string }

      if (!result.code)
        throw new Error(`Failed to fetch module ${id}`)

      const dir = join(project.tmpDir, transformMode)
      const tmp = join(dir, id.replace(/[/\\?%*:|"<>]/g, '_').replace('\0', '__x00__'))
      if (promises.has(tmp)) {
        await promises.get(tmp)
        return { id: tmp }
      }
      if (!created.has(dir)) {
        await mkdir(dir, { recursive: true })
        created.add(dir)
      }
      const code = result.code
      promises.set(tmp, writeFile(tmp, code, 'utf-8').finally(() => promises.delete(tmp)))
      await promises.get(tmp)
      result.code = undefined
      Object.assign(result, { id: tmp })
      return { id: tmp }
    },
    resolveId(id, importer, transformMode) {
      return project.vitenode.resolveId(id, importer, transformMode)
    },
    transform(id, environment) {
      return project.vitenode.transformModule(id, environment)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      return ctx.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
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
