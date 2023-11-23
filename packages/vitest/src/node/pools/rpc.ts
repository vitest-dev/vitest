import type { RawSourceMap } from 'vite-node'
import type { RuntimeRPC } from '../../types'
import type { WorkspaceProject } from '../workspace'

export function createMethodsRPC(project: WorkspaceProject): RuntimeRPC {
  const ctx = project.ctx
  return {
    async onWorkerExit(error, code) {
      await ctx.logger.printError(error, { type: 'Unexpected Exit', fullStack: true })
      process.exit(code || 1)
    },
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
    fetch(id, transformMode) {
      return project.vitenode.fetchModule(id, transformMode)
    },
    resolveId(id, importer, transformMode) {
      return project.vitenode.resolveId(id, importer, transformMode)
    },
    transform(id, environment) {
      return project.vitenode.transformModule(id, environment)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      return project.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      return project.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      return project.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      return project.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      return project.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
    onCancel(reason) {
      ctx.cancelCurrentRun(reason)
    },
    getCountOfFailedTests() {
      return ctx.state.getCountOfFailedTests()
    },
  }
}
