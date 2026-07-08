import type { DevEnvironment, EnvironmentModuleNode, FetchResult } from 'vite'
import type { FetchFunctionOptions } from 'vite/module-runner'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { RuntimeRPC } from '../../types/rpc'
import type { OTELCarrier } from '../../utils/traces'
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

  function getEnvironment(environmentName: string): DevEnvironment {
    const environment = project.vite.environments[environmentName]
    if (!environment) {
      throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
    }
    return environment
  }

  async function fetchModule(
    url: string,
    importer: string | undefined,
    environment: DevEnvironment,
    options?: FetchFunctionOptions,
    otelCarrier?: OTELCarrier,
    // graph prewarm calls race each other and the workers' own fetches over
    // the same in-flight transforms, so each caller's wall time massively
    // overcounts the actual transform work — only direct fetches are timed
    accountTiming = true,
  ): Promise<FetchResult | FetchCachedFileSystemResult> {
    const start = performance.now()

    return await project._fetcher(url, importer, environment, cacheFs, options, otelCarrier).then((result) => {
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
      if (accountTiming) {
        const duration = performance.now() - start
        project.vitest.state.transformTime += duration
        metadata.duration[url] ??= []
        metadata.duration[url].push(duration)
      }
      return result
    })
  }

  return {
    async fetch(
      url,
      importer,
      environmentName,
      options,
      otelCarrier,
    ) {
      return fetchModule(url, importer, getEnvironment(environmentName), options, otelCarrier)
    },
    async fetchWarmModules(environmentName, files) {
      const environment = project.vite.environments[environmentName]
      if (!environment) {
        throw new Error(`The environment ${environmentName} was not defined in the Vite config.`)
      }

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
          // the fetch that stored this module on disk also memoized its module
          // type on the transform result (only when `injectCjsGlobals` is
          // disabled); reuse it so the evaluator injects the CJS globals for the
          // same modules it would on the direct-fetch path, no re-detection here
          moduleType: transformResult.__vitestModuleType,
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
    async prewarmModuleGraph(environmentName, files) {
      const environment = getEnvironment(environmentName)
      const moduleGraph = environment.moduleGraph
      const seen = new Set<string>()

      async function walkNode(node: EnvironmentModuleNode): Promise<void> {
        const children: Promise<void>[] = []
        for (const child of node.importedModules) {
          if (child.url == null || seen.has(child.url)) {
            continue
          }
          if (child.transformResult) {
            seen.add(child.url)
            children.push(walkNode(child))
          }
          else {
            children.push(fetchNode(child.url, node.id ?? undefined))
          }
        }
        if (children.length) {
          await Promise.all(children)
        }
      }

      async function fetchNode(url: string, importer: string | undefined): Promise<void> {
        if (seen.has(url)) {
          return
        }
        seen.add(url)
        try {
          await fetchModule(url, importer, environment, undefined, undefined, false)
        }
        catch {
          // the worker's own fetch will surface the error with the proper
          // import context
          return
        }
        let node: EnvironmentModuleNode | undefined
        try {
          node = await moduleGraph.getModuleByUrl(url) ?? moduleGraph.getModuleById(url) ?? undefined
        }
        catch {
          node = moduleGraph.getModuleById(url) ?? undefined
        }
        if (node) {
          await walkNode(node)
        }
      }

      await Promise.all([...files, ...project.config.setupFiles].map(async (file) => {
        const nodes = moduleGraph.getModulesByFile(file)
        if (nodes && nodes.size) {
          await Promise.all(Array.from(nodes, (node) => {
            if (node.transformResult) {
              seen.add(node.url)
              return walkNode(node)
            }
            return fetchNode(node.url, undefined)
          }))
        }
        else {
          await fetchNode(file, undefined)
        }
      }))
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
