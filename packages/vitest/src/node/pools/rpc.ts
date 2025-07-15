import type { DevEnvironment } from 'vite'
import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { cleanUrl, withTrailingSlash, wrapId } from '@vitest/utils'
import { createFetchModuleFunction, handleRollupError } from '../environments/fetchModule'

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
