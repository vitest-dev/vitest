import type { RawSourceMap } from 'vite-node'
import type { RuntimeRPC } from '../../types'
import { getEnvironmentTransformMode } from '../../utils/base'
import type { VitestWorkspace } from '../workspace'

export function createMethodsRPC(workspace: VitestWorkspace): RuntimeRPC {
  const ctx = workspace.ctx
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
        const mod = workspace.server.moduleGraph.getModuleById(id)
        if (mod)
          workspace.server.moduleGraph.invalidateModule(mod)
      }
      const r = await workspace.vitenode.transformRequest(id)
      return r?.map as RawSourceMap | undefined
    },
    fetch(id, environment) {
      const transformMode = getEnvironmentTransformMode(workspace.config, environment)
      return workspace.vitenode.fetchModule(id, transformMode)
    },
    resolveId(id, importer, environment) {
      const transformMode = getEnvironmentTransformMode(workspace.config, environment)
      return workspace.vitenode.resolveId(id, importer, transformMode)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      workspace.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      workspace.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      workspace.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      workspace.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      workspace.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
  }
}
