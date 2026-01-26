import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cleanUrl } from '@vitest/utils/helpers'
import { isBuiltin, toBuiltin } from '../../utils/modules'
import { handleRollupError } from '../environments/fetchModule'
import { normalizeResolvedIdToUrl } from '../environments/normalizeUrl'

interface MethodsOptions {
  cacheFs?: boolean
  // do not report files
  collect?: boolean
}

export function createMethodsRPC(project: TestProject, methodsOptions: MethodsOptions = {}): RuntimeRPC {
  const vitest = project.vitest
  const cacheFs = methodsOptions.cacheFs ?? false
  project.vitest.state.metadata[project.name] ??= {
    externalized: {},
    duration: {},
    tmps: {},
  }
  if (project.config.dumpDir && !existsSync(project.config.dumpDir)) {
    mkdirSync(project.config.dumpDir, { recursive: true })
  }
  project.vitest.state.metadata[project.name].dumpDir = project.config.dumpDir
  return {
    async fetch(
      url,
      importer,
      environmentName,
      options,
      otelCarrier,
    ) {
      const environment = project.vite.environments[environmentName]
      if (!environment) {
        throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
      }

      const start = performance.now()

      return await project._fetcher(url, importer, environment, cacheFs, options, otelCarrier).then((result) => {
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
      const file = cleanUrl(resolved.id)
      if (resolved.external) {
        return {
          file,
          // this is only used by the module mocker and it always
          // standardizes the id to mock "node:url" and "url" at the same time
          url: isBuiltin(resolved.id)
            ? toBuiltin(resolved.id)
            : resolved.id,
          id: resolved.id,
        }
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
      if (methodsOptions.collect) {
        vitest.state.collectFiles(project, [file])
      }
      else {
        await vitest._testRun.enqueued(project, file)
      }
    },
    async onCollected(files) {
      if (methodsOptions.collect) {
        vitest.state.collectFiles(project, files)
      }
      else {
        await vitest._testRun.collected(project, files)
      }
    },
    onAfterSuiteRun(meta) {
      vitest.coverageProvider?.onAfterSuiteRun(meta)
    },
    async onTaskArtifactRecord(testId, artifact) {
      return vitest._testRun.recordArtifact(testId, artifact)
    },
    async onTaskUpdate(packs, events) {
      if (methodsOptions.collect) {
        vitest.state.updateTasks(packs)
      }
      else {
        await vitest._testRun.updated(packs, events)
      }
    },
    async onUserConsoleLog(log) {
      if (methodsOptions.collect) {
        vitest.state.updateUserLog(log)
      }
      else {
        await vitest._testRun.log(log)
      }
    },
    onUnhandledError(err, type) {
      vitest.state.catchError(err, type)
    },
    onAsyncLeaks(leaks) {
      vitest.state.catchLeaks(leaks)
    },
    onCancel(reason) {
      vitest.cancelCurrentRun(reason)
    },
    getCountOfFailedTests() {
      return vitest.state.getCountOfFailedTests()
    },

    ensureModuleGraphEntry(id, importer) {
      const filepath = id.startsWith('file:') ? fileURLToPath(id) : id
      const importerPath = importer.startsWith('file:') ? fileURLToPath(importer) : importer
      // environment itself doesn't matter
      const moduleGraph = project.vite.environments.__vitest__?.moduleGraph
      if (!moduleGraph) {
        // TODO: is it possible?
        console.error('no module graph for', id)
        return
      }
      const importerNode = moduleGraph.getModuleById(importerPath) || moduleGraph.createFileOnlyEntry(importerPath)
      const moduleNode = moduleGraph.getModuleById(filepath) || moduleGraph.createFileOnlyEntry(filepath)

      if (!moduleGraph.idToModuleMap.has(importerPath)) {
        importerNode.id = importerPath
        moduleGraph.idToModuleMap.set(importerPath, importerNode)
      }
      if (!moduleGraph.idToModuleMap.has(filepath)) {
        moduleNode.id = filepath
        moduleGraph.idToModuleMap.set(filepath, moduleNode)
      }

      // this is checked by the "printError" function - TODO: is there a better way?
      moduleNode.transformResult = {
        code: ' ',
        map: null,
      }
      importerNode.importedModules.add(moduleNode)
      moduleNode.importers.add(importerNode)
    },
  }
}
