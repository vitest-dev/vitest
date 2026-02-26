import type vm from 'node:vm'
import type { EvaluatedModules } from 'vite/module-runner'
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

  const evaluator = options.evaluator || new VitestModuleEvaluator(
    vm,
    {
      traces,
      evaluatedModules: options.evaluatedModules,
      get moduleExecutionInfo() {
        return state().moduleExecutionInfo
      },
      get interopDefault() {
        return state().config.deps.interopDefault
      },
      getCurrentTestFilepath: () => state().filepath,
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

        const rawId = unwrapId(id)
        resolvingModules.add(rawId)

        try {
          if (VitestMocker.pendingIds.length) {
            await moduleRunner.mocker.resolveMocks()
          }

          const resolvedMock = moduleRunner.mocker.getDependencyMock(rawId)
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

          if (isBuiltin(rawId)) {
            return { externalize: rawId, type: 'builtin' }
          }

          if (isBrowserExternal(rawId)) {
            return { externalize: toBuiltin(rawId), type: 'builtin' }
          }

          // if module is invalidated, the worker will be recreated,
          // so cached is always true in a single worker
          if (options?.cached) {
            return { cache: true }
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
