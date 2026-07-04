import type vm from 'node:vm'
import type { EvaluatedModules, FetchResult } from 'vite/module-runner'
import type { FetchCachedFileSystemResult } from '../../types/general'
import type { WorkerGlobalState } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import type { ExternalModulesExecutor } from '../external-executor'
import type { CreateImportMeta } from './moduleRunner'
import fs from 'node:fs'
import { isBareImport } from '@vitest/utils/helpers'
import { isBrowserExternal, isBuiltin, toBuiltin } from '../../utils/modules'
import { getSafeWorkerState } from '../utils'
import { getCachedVitestImport } from './cachedResolver'
import { unwrapId, VitestModuleEvaluator } from './moduleEvaluator'
import { VitestMocker } from './moduleMocker'
import { VitestModuleRunner } from './moduleRunner'
import { removeQuery } from './utils'

const { readFileSync } = fs

export const VITEST_VM_CONTEXT_SYMBOL: string = '__vitest_vm_context__'

export interface ContextModuleRunnerOptions {
  evaluatedModules: EvaluatedModules
  mocker?: VitestMocker
  evaluator?: VitestModuleEvaluator
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
  state: WorkerGlobalState
  /**
   * @internal
   */
  traces?: Traces // optional to keep backwards compat
  spyModule?: typeof import('@vitest/spy')
  createImportMeta?: CreateImportMeta
}

const cwd = process.cwd()
const isWindows = process.platform === 'win32'

export function startVitestModuleRunner(options: ContextModuleRunnerOptions): VitestModuleRunner {
  const traces = options.traces
  const state = (): WorkerGlobalState =>
    getSafeWorkerState() || options.state
  const rpc = () => state().rpc

  const environment = () => {
    const environment = state().environment
    return environment.viteEnvironment || environment.name
  }

  const vm = options.context && options.externalModulesExecutor
    ? {
        context: options.context,
        externalModulesExecutor: options.externalModulesExecutor,
      }
    : undefined

  // A fresh worker pays one strictly sequential `fetch` round-trip per module
  // in its test files' import graphs, even when the server processed all of
  // them already. Ask the server ONCE per run request for everything it has on
  // disk and answer those fetches locally. A file change invalidates the module
  // server-side, dropping it from the snapshot of every subsequent run request,
  // which keeps reused (isolate: false) workers in sync; an edit DURING a run
  // was racy before this fast path existed and stays racy with it — the
  // scheduled rerun always sees the fresh transform.
  let warmModules: Promise<Record<string, FetchResult | FetchCachedFileSystemResult> | null> | undefined
  let warmModulesContext: unknown

  function fetchWarmModules() {
    const workerState = state()
    if (warmModulesContext !== workerState.ctx) {
      warmModulesContext = workerState.ctx
      warmModules = rpc()
        .fetchWarmModules(environment(), workerState.ctx.files.map(file => file.filepath))
        // if the snapshot cannot be fetched, fall back to per-module fetches
        .catch(() => null)
    }
    return warmModules!
  }

  const evaluator = options.evaluator || new VitestModuleEvaluator(
    vm,
    {
      traces,
      metaEnv: state().metaEnv,
      evaluatedModules: options.evaluatedModules,
      get moduleExecutionInfo() {
        return state().moduleExecutionInfo
      },
      get interopDefault() {
        return state().config.deps.interopDefault
      },
      getCurrentTestFilepath: () => state().filepath,
      getterTracker: state().getterTracker,
    },
  )

  const moduleRunner: VitestModuleRunner = new VitestModuleRunner({
    spyModule: options.spyModule,
    evaluatedModules: options.evaluatedModules,
    evaluator,
    traces,
    mocker: options.mocker,
    transport: {
      async fetchModule(id, importer, options) {
        const resolvingModules = state().resolvingModules

        if (isWindows) {
          if (id[1] === ':') {
            // The drive letter is different for whatever reason, we need to normalize it to CWD
            if (id[0] !== cwd[0] && id[0].toUpperCase() === cwd[0].toUpperCase()) {
              const isUpperCase = cwd[0].toUpperCase() === cwd[0]
              id = (isUpperCase ? id[0].toUpperCase() : id[0].toLowerCase()) + id.slice(1)
            }
            // always mark absolute windows paths, otherwise Vite will externalize it
            id = `/@id/${id}`
          }
        }

        const vitest = getCachedVitestImport(id, state)
        if (vitest) {
          return vitest
        }

        // strip _vitest_original query added by importActual so that
        // the plugin pipeline sees the original import id (e.g. virtual modules's load hook)
        const isImportActual = id.includes('_vitest_original')
        if (isImportActual) {
          id = removeQuery(id, '_vitest_original')
        }

        const rawId = unwrapId(id)
        resolvingModules.add(rawId)

        try {
          if (VitestMocker.pendingIds.length) {
            await moduleRunner.mocker.resolveMocks()
          }

          if (!isImportActual) {
            const resolvedMock = moduleRunner.mocker.getDependencyMockByUrl(id)
            if (resolvedMock?.type === 'manual' || resolvedMock?.type === 'redirect') {
              return {
                code: '',
                file: null,
                id: resolvedMock.id,
                url: resolvedMock.url,
                invalidate: false,
                mockedModule: resolvedMock,
              }
            }
          }

          if (isBuiltin(rawId)) {
            return { externalize: rawId, type: 'builtin' }
          }

          if (isBrowserExternal(rawId)) {
            return { externalize: toBuiltin(rawId), type: 'builtin' }
          }

          // if module is invalidated, the worker will be recreated,
          // so cached is always true in a single worker
          if (!isImportActual && options?.cached) {
            return { cache: true }
          }

          // only dependency fetches consult the snapshot: by the time the
          // first dependency is requested, the entry file is transformed and
          // its import graph is connected on the server, so the snapshot
          // actually covers the file's transitive dependencies
          if (importer != null) {
            const warm = await fetchWarmModules()
            // the null prototype is not preserved by the IPC serialization, so
            // ids like "constructor" must not fall through to Object.prototype
            const warmResult = warm && (
              Object.hasOwn(warm, id)
                ? warm[id]
                : Object.hasOwn(warm, rawId)
                  ? warm[rawId]
                  : undefined
            )
            if (warmResult) {
              if ('tmp' in warmResult) {
                try {
                  const code = readFileSync(warmResult.tmp, 'utf-8')
                  return { code, ...warmResult }
                }
                catch {
                  // the tmp file is gone — fall back to a live fetch
                }
              }
              else {
                return warmResult
              }
            }
          }

          const otelCarrier = traces?.getContextCarrier()
          const result = await rpc().fetch(
            id,
            importer,
            environment(),
            options,
            otelCarrier,
          )
          if ('cached' in result) {
            const code = readFileSync(result.tmp, 'utf-8')
            return { code, ...result }
          }
          return result
        }
        catch (cause: any) {
          // rethrow vite error if it cannot load the module because it's not resolved
          if (
            (typeof cause === 'object' && cause != null && cause.code === 'ERR_LOAD_URL')
            || (typeof cause?.message === 'string' && cause.message.includes('Failed to load url'))
            || (typeof cause?.message === 'string' && cause.message.startsWith('Cannot find module \''))
          ) {
            const error = new Error(
              `Cannot find ${isBareImport(id) ? 'package' : 'module'} '${id}'${importer ? ` imported from ${importer}` : ''}`,
              { cause },
            ) as Error & { code: string }
            error.code = 'ERR_MODULE_NOT_FOUND'
            throw error
          }

          throw cause
        }
        finally {
          resolvingModules.delete(rawId)
        }
      },
      resolveId(id, importer) {
        return rpc().resolve(
          id,
          importer,
          environment(),
        )
      },
    },
    getWorkerState: state,
    vm,
    createImportMeta: options.createImportMeta,
  })

  return moduleRunner
}
