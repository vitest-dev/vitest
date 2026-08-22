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
import { getPrewarmHints, handleRollupError } from '../environments/fetchModule'
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
    // per-module durations are only recorded for direct worker fetches: the
    // graph prewarm fetches whole levels concurrently, so its per-module wall
    // times measure the queue position, not the module's own transform cost
    accountModuleDuration = true,
  ): Promise<FetchResult | FetchCachedFileSystemResult> {
    const state = project.vitest.state
    const start = performance.now()

    return await project._fetcher(url, importer, environment, cacheFs, options, otelCarrier).then((result) => {
      const metadata = state.metadata[project.name]
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
      if (accountModuleDuration) {
        const duration = performance.now() - start
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
      const noSkips: ReadonlySet<string> = new Set()

      // `skip` holds the ids a root test file replaces with `vi.mock(id, factory)`:
      // the worker never requests those modules (the factory answers instead),
      // so neither they nor their subtrees are worth transforming for that
      // file. Another root that imports them for real still fetches them.
      async function walkNode(node: EnvironmentModuleNode, skip: ReadonlySet<string>): Promise<void> {
        const children: Promise<unknown>[] = []
        // `import()` targets are fetched by the worker only if and when the
        // import executes; prewarming them would transform whole lazily-loaded
        // subtrees most tests never touch. A module the importer ALSO imports
        // statically is still walked.
        const dynamicOnly = getPrewarmHints(environment, node)?.dynamicDeps
        for (const child of node.importedModules) {
          if (child.url == null || seen.has(child.url)) {
            continue
          }
          if (child.id != null && skip.has(child.id)) {
            continue
          }
          if (dynamicOnly?.includes(child.url)) {
            continue
          }
          if (child.transformResult) {
            seen.add(child.url)
            children.push(walkNode(child, skip))
          }
          else {
            children.push(fetchNode(child.url, node.id ?? undefined, skip))
          }
        }
        if (children.length) {
          await Promise.all(children)
        }
      }

      async function fetchNode(url: string, importer: string | undefined, skip: ReadonlySet<string>): Promise<EnvironmentModuleNode | undefined> {
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
          // a root is fetched before its mocks are known; resolve them now
          const rootSkip = skip === noSkips && importer === undefined ? await factoryMockedIds(node) : skip
          await walkNode(node, rootSkip)
        }
        return node
      }

      // ids the test file mocks with a factory, as recorded by the hoistMocks
      // transform (`vi.mock('./x', () => ...)`, `vi.mock(import('./x'), ...)`)
      async function factoryMockedIds(node: EnvironmentModuleNode): Promise<ReadonlySet<string>> {
        if (node.id == null) {
          return noSkips
        }
        const specifiers = getPrewarmHints(environment, node)?.staticMocks?.filter(call => call.method === 'mock' && call.hasFactory)
        if (!specifiers?.length) {
          return noSkips
        }
        const ids = new Set<string>()
        await Promise.all(specifiers.map(async ({ specifier }) => {
          try {
            const resolved = await environment.pluginContainer.resolveId(specifier, node.id!)
            if (resolved?.id) {
              ids.add(resolved.id)
            }
          }
          catch {
            // unresolvable here; the worker reports it if it matters
          }
        }))
        return ids
      }

      await Promise.all([...files, ...project.config.setupFiles].map(async (file) => {
        const nodes = moduleGraph.getModulesByFile(file)
        if (nodes && nodes.size) {
          await Promise.all(Array.from(nodes, async (node) => {
            if (node.transformResult) {
              seen.add(node.url)
              return walkNode(node, await factoryMockedIds(node))
            }
            return fetchNode(node.url, undefined, noSkips)
          }))
        }
        else {
          await fetchNode(file, undefined, noSkips)
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
