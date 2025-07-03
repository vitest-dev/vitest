import type vm from 'node:vm'
import type { EvaluatedModules } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import fs from 'node:fs'
import { isBuiltin } from 'node:module'
import { isBareImport } from '@vitest/utils'
import { getCachedVitestImport } from './cachedResolver'
import { listenForErrors } from './errorCatcher'
import { unwrapId, VitestModuleEvaluator } from './moduleEvaluator'
import { VitestMocker } from './moduleMocker'
import { VitestModuleRunner } from './moduleRunner'

const { readFileSync } = fs

const browserExternalId = '__vite-browser-external'
const browserExternalLength = browserExternalId.length + 1 // 1 is ":"

export const VITEST_VM_CONTEXT_SYMBOL: string = '__vitest_vm_context__'

export interface ContextModuleRunnerOptions {
  evaluatedModules: EvaluatedModules
  mocker?: VitestMocker
  evaluator?: VitestModuleEvaluator
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
  state: WorkerGlobalState
}

export async function startVitestModuleRunner(options: ContextModuleRunnerOptions): Promise<VitestModuleRunner> {
  const state = (): WorkerGlobalState =>
    // @ts-expect-error injected untyped global
    globalThis.__vitest_worker__ || options.state
  const rpc = () => state().rpc

  process.exit = (code = process.exitCode || 0): never => {
    throw new Error(`process.exit unexpectedly called with "${code}"`)
  }

  listenForErrors(state)

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
      get interopDefault() {
        return state().config.deps.interopDefault
      },
      getCurrentTestFilepath: () => state().filepath,
    },
  )

  const moduleRunner: VitestModuleRunner = new VitestModuleRunner({
    evaluatedModules: options.evaluatedModules,
    evaluator,
    mocker: options.mocker,
    transport: {
      async fetchModule(id, importer, options) {
        const resolvingModules = state().resolvingModules

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
              id,
              url: id,
              invalidate: false,
              mockedModule: resolvedMock,
            }
          }

          if (isBuiltin(rawId) || rawId.startsWith(browserExternalId)) {
            return { externalize: toBuiltin(rawId), type: 'builtin' }
          }

          const result = await rpc().fetch(
            id,
            importer,
            environment(),
            options,
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
              `Cannot find ${isBareImport(id) ? 'package' : 'module'} '${id}'${importer ? ` imported from '${importer}'` : ''}`,
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
  })

  await moduleRunner.import('/@vite/env')
  await moduleRunner.mocker.initializeSpyModule()

  return moduleRunner
}

export function toBuiltin(id: string): string {
  if (id.startsWith(browserExternalId)) {
    id = id.slice(browserExternalLength)
  }

  if (!id.startsWith('node:')) {
    id = `node:${id}`
  }
  return id
}
