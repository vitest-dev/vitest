import type { DevEnvironment, EnvironmentModuleNode, FetchResult } from 'vite'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { RuntimeRPC } from '../../types/rpc'
import type { TestProject } from '../project'
import type { ResolveSnapshotPathHandlerContext } from '../types/config'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { cleanUrl } from '@vitest/utils/helpers'
import { isBuiltin, toBuiltin } from '../../utils/modules'
import { handleRollupError } from '../environments/fetchModule'
import { normalizeResolvedIdToUrl } from '../environments/normalizeUrl'
import { detectModuleType } from '../resolver'

interface MethodsOptions {
  cacheFs?: boolean
  // do not report files
  collect?: boolean
}

// externalize verdicts served during this session, shared with fresh workers
// via `fetchWarmModules`. Only verdicts for already-resolved urls are stored:
// an unresolved specifier (a runtime-variable dynamic import of a bare name)
// resolves through the requesting environment's plugin container, so its
// verdict is importer-specific and cannot be shared.
// Keyed by the DevEnvironment, not the server: a leading-slash url still
// resolves to its id through that environment's plugin container, so a plugin
// that resolves conditionally (e.g. on `this.environment`) can externalize the
// same url in one environment and inline it in another — sharing the verdict
// across environments would serve the wrong one. Per-environment keying also
// drops the verdicts on a server restart, since environments are recreated.
const warmExternals = new WeakMap<DevEnvironment, Record<string, FetchResult>>()

// `detectModuleType` only reads the original source in the ambiguous case where
// the transformed code both looks like ESM and mentions a CommonJS variable;
// mirror the guard `ModuleFetcher.sourceLoader` uses for virtual modules
function warmSourceLoader(file: string | null): (() => Promise<string | null>) | undefined {
  if (!file || file.startsWith('\x00') || file.startsWith('virtual:')) {
    return undefined
  }
  return () => readFile(file, 'utf-8').then(source => source, () => null)
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
          // builtins and network urls are already resolved inside the worker
          // without a round-trip, only module externalizations are worth sharing
          if (result.type === 'module' && url[0] === '/') {
            let externals = warmExternals.get(environment)
            if (!externals) {
              externals = Object.create(null) as Record<string, FetchResult>
              warmExternals.set(environment, externals)
            }
            externals[url] = result
          }
        }
        if ('tmp' in result) {
          metadata.tmps[url] = result.tmp
        }
        metadata.duration[url] ??= []
        metadata.duration[url].push(duration)
        return result
      })
    },
    async fetchWarmModules(environmentName, files) {
      const environment = project.vite.environments[environmentName]
      if (!environment) {
        throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
      }

      // with `injectCjsGlobals: false` the evaluator injects the CommonJS
      // variables only into modules the server tagged `moduleType: 'cjs'`. that
      // tag is produced by the per-module `fetch`, which the warm snapshot
      // bypasses, so it has to be recomputed here — otherwise a CommonJS module
      // served from the snapshot evaluates without `require`/`module`/`__dirname`
      // and throws. the detection is skipped entirely on the default path.
      const detectType = project.config.injectCjsGlobals === false

      const warm: Record<string, FetchResult | FetchCachedFileSystemResult> = Object.create(null)

      // walk the import graphs of the requested files instead of dumping the
      // whole module graph — in large (watch) sessions the graph accumulates
      // modules this worker will never load
      const moduleGraph = environment.moduleGraph
      const queue: EnvironmentModuleNode[] = []
      for (const file of [...files, ...project.config.setupFiles]) {
        const nodes = moduleGraph.getModulesByFile(file)
        if (nodes) {
          queue.push(...nodes)
        }
      }

      const seen = new Set<EnvironmentModuleNode>()
      while (queue.length) {
        const node = queue.pop()!
        if (seen.has(node)) {
          continue
        }
        seen.add(node)
        queue.push(...node.importedModules)

        const transformResult = node.transformResult
        if (!transformResult || node.id == null) {
          continue
        }
        // the transformed code is already stored on disk either by the forks
        // pool (`cacheFs`) or by `experimental.fsModuleCache` — the worker can
        // read the file itself instead of fetching each module separately.
        // invalidated modules lose `transformResult` and drop out automatically
        const tmp = transformResult.__vitestTmp ?? (transformResult as { _vitest_tmp?: string })._vitest_tmp
        if (typeof tmp !== 'string') {
          continue
        }
        const entry: FetchCachedFileSystemResult = {
          cached: true,
          file: node.file,
          id: node.id,
          tmp,
          url: node.url,
          invalidate: false,
          moduleType: detectType
            ? await detectModuleType(node.file, transformResult.code, warmSourceLoader(node.file))
            : undefined,
        }
        warm[node.url] = entry
        if (node.id !== node.url) {
          warm[node.id] = entry
        }
      }

      const externals = warmExternals.get(environment)
      if (externals) {
        for (const url in externals) {
          warm[url] ??= externals[url]
        }
      }

      return warm
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
    async onTestBenchmark(testId, benchmark) {
      return vitest._testRun.recordBenchmark(testId, benchmark)
    },
    async readBenchmarkResult(relativePath) {
      return project.benchmark.readResult(relativePath)
    },
    async writeBenchmarkResult(relativePath, data) {
      return project.benchmark.writeResult(relativePath, data)
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
