import type { RawSourceMap } from 'vite-node'
import type { RuntimeRPC } from '../../types'
import { getEnvironmentTransformMode } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'

export function createMethodsRPC(project: WorkspaceProject): RuntimeRPC {
  const ctx = project.ctx
  return {
    async onWorkerExit(error, code) {
      await ctx.logger.printError(error, false, 'Unexpected Exit')
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
    fetch(id, environment) {
      const transformMode = getEnvironmentTransformMode(project.config, environment)
      return project.vitenode.fetchModule(id, transformMode)
    },
    resolveId(id, importer, environment) {
      const transformMode = getEnvironmentTransformMode(project.config, environment)
      return project.vitenode.resolveId(id, importer, transformMode)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      project.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      project.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      project.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      project.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      project.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
  }
}
