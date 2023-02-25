import type { RawSourceMap } from 'vite-node'
import type { RuntimeRPC } from '../../types'
import { getEnvironmentTransformMode } from '../../utils/base'
import type { Vitest } from '../core'

export function createMethodsRPC(ctx: Vitest): RuntimeRPC {
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
        const mod = ctx.server.moduleGraph.getModuleById(id)
        if (mod)
          ctx.server.moduleGraph.invalidateModule(mod)
      }
      const r = await ctx.vitenode.transformRequest(id)
      return r?.map as RawSourceMap | undefined
    },
    fetch(id, environment) {
      const transformMode = getEnvironmentTransformMode(ctx.config, environment)
      return ctx.vitenode.fetchModule(id, transformMode)
    },
    resolveId(id, importer, environment) {
      const transformMode = getEnvironmentTransformMode(ctx.config, environment)
      return ctx.vitenode.resolveId(id, importer, transformMode)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      ctx.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      ctx.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      ctx.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      ctx.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      ctx.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
  }
}
