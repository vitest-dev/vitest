import type vm from 'node:vm'
import type { EvaluatedModules } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import type { VitestModuleRunnerOptions } from './moduleRunner'
import fs from 'node:fs'
import { getCachedVitestImport } from './cachedResolver'
import { listenForErrors } from './errorCatcher'
import { VitestModuleRunner } from './moduleRunner'

const { readFileSync } = fs

export interface ExecuteOptions {
  moduleDirectories?: string[]
  state: WorkerGlobalState
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
}

async function createVitestModuleRunner(options: VitestModuleRunnerOptions): Promise<VitestModuleRunner> {
  const moduleRunner = new VitestModuleRunner(options)

  await moduleRunner.import('/@vite/env')
  await moduleRunner.mocker.initializeSpyModule()

  return moduleRunner
}

export interface ContextExecutorOptions {
  evaluatedModules: EvaluatedModules
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
  state: WorkerGlobalState
}

export async function startVitestModuleRunner(options: ContextExecutorOptions): Promise<VitestModuleRunner> {
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

  const moduleRunner = await createVitestModuleRunner({
    evaluatedModules: options.evaluatedModules,
    transport: {
      async fetchModule(id, importer, options) {
        const vitest = getCachedVitestImport(id, state)
        if (vitest) {
          return { ...vitest, type: 'module' }
        }

        const result = await rpc().fetch(
          id,
          importer,
          environment(),
          options,
        )
        if ('cached' in result) {
          const code = readFileSync(result.id, 'utf-8')
          return { code, ...result }
        }
        return result
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
    vm: options.context && options.externalModulesExecutor
      ? {
          context: options.context,
          externalModulesExecutor: options.externalModulesExecutor,
        }
      : undefined,
  })
  return moduleRunner
}
