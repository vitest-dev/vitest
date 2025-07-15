import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { fileURLToPath } from 'node:url'
import { cleanUrl } from '@vitest/utils'
import { createFetchModuleFunction, handleRollupError } from '../environments/fetchModule'
import { normalizeResolvedIdToUrl } from '../environments/normalizeUrl'

interface MethodsOptions {
  cacheFs?: boolean
  // do not report files
  collect?: boolean
}

export function createMethodsRPC(project: TestProject, options: MethodsOptions = {}): RuntimeRPC {
  const ctx = project.vitest
  const cacheFs = options.cacheFs ?? false
  const fetch = createFetchModuleFunction(project._resolver, cacheFs, project.tmpDir)
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

      return fetch(url, importer, environment, options)
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
      const environment = project.vite.environments.__vm__
      if (!environment) {
        throw new Error(`The VM environment was not defined in the Vite config. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      }

      const url = normalizeResolvedIdToUrl(environment, fileURLToPath(id))
      const result = await environment.transformRequest(url).catch(handleRollupError)
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
