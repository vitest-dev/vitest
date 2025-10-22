import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { fileURLToPath } from 'node:url'
import { cleanUrl } from '@vitest/utils/helpers'
import { handleRollupError } from '../environments/fetchModule'
import { normalizeResolvedIdToUrl } from '../environments/normalizeUrl'

interface MethodsOptions {
  cacheFs?: boolean
  // do not report files
  collect?: boolean
}

export function createMethodsRPC(project: TestProject, options: MethodsOptions = {}): RuntimeRPC {
  const vitest = project.vitest
  const cacheFs = options.cacheFs ?? false
  project.vitest.state.metadata[project.name] ??= {
    externalized: {},
    duration: {},
    tmps: {},
  }
  project.vitest.state.metadata[project.name].dumpDir = project.config.dumpDir
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

      const start = performance.now()

      return await project._fetcher(url, importer, environment, cacheFs, options).then((result) => {
        const duration = performance.now() - start
        project.vitest.state.transformTime += duration
        const metadata = project.vitest.state.metadata[project.name]
        if ('externalize' in result) {
          metadata.externalized[url] = result.externalize
        }
        if ('tmp' in result) {
          metadata.tmps[url] = result.tmp
        }
        metadata.duration[url] ??= []
        metadata.duration[url].push(duration)
        return result
      })
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
      vitest.snapshot.add(snapshot)
    },
    resolveSnapshotPath(testPath: string) {
      return vitest.snapshot.resolvePath<ResolveSnapshotPathHandlerContext>(testPath, {
        config: project.serializedConfig,
      })
    },
    async transform(id) {
      const environment = project.vite.environments.__vitest_vm__
      if (!environment) {
        throw new Error(`The VM environment was not defined in the Vite config. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      }

      const url = normalizeResolvedIdToUrl(environment, fileURLToPath(id))
      const result = await environment.transformRequest(url).catch(handleRollupError)
      return { code: result?.code }
    },
    async onQueued(file) {
      if (options.collect) {
        vitest.state.collectFiles(project, [file])
      }
      else {
        await vitest._testRun.enqueued(project, file)
      }
    },
    async onCollected(files) {
      if (options.collect) {
        vitest.state.collectFiles(project, files)
      }
      else {
        await vitest._testRun.collected(project, files)
      }
    },
    onAfterSuiteRun(meta) {
      vitest.coverageProvider?.onAfterSuiteRun(meta)
    },
    async onTaskAnnotate(testId, annotation) {
      return vitest._testRun.annotate(testId, annotation)
    },
    async onTaskUpdate(packs, events) {
      if (options.collect) {
        vitest.state.updateTasks(packs)
      }
      else {
        await vitest._testRun.updated(packs, events)
      }
    },
    async onUserConsoleLog(log) {
      if (options.collect) {
        vitest.state.updateUserLog(log)
      }
      else {
        await vitest._testRun.log(log)
      }
    },
    onUnhandledError(err, type) {
      vitest.state.catchError(err, type)
    },
    onCancel(reason) {
      vitest.cancelCurrentRun(reason)
    },
    getCountOfFailedTests() {
      return vitest.state.getCountOfFailedTests()
    },
  }
}
