import type { Environment } from '../../types/environment'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import type { VitestModuleRunner } from '../moduleRunner/moduleRunner'
import type { ContextModuleRunnerOptions } from '../moduleRunner/startModuleRunner'
import { runInThisContext } from 'node:vm'
import * as spyModule from '@vitest/spy'
import { setupChaiConfig } from '../../integrations/chai/config'
import { loadEnvironment } from '../../integrations/env/loader'
import { emitModuleRunner } from '../listeners'
import { VitestEvaluatedModules } from '../moduleRunner/evaluatedModules'
import { createNodeImportMeta } from '../moduleRunner/moduleRunner'
import { startVitestModuleRunner } from '../moduleRunner/startModuleRunner'
import { run } from '../runBaseTests'
import { provideWorkerState } from '../utils'

let _moduleRunner: VitestModuleRunner

const evaluatedModules = new VitestEvaluatedModules()
const moduleExecutionInfo = new Map()

function startModuleRunner(options: ContextModuleRunnerOptions) {
  if (_moduleRunner) {
    return _moduleRunner
  }

  _moduleRunner = startVitestModuleRunner(options)
  return _moduleRunner
}

let _currentEnvironment!: Environment
let _environmentTime: number

/** @experimental */
export async function setupEnvironment(context: WorkerSetupContext): Promise<() => Promise<void>> {
  const startTime = performance.now()
  const {
    environment: { name: environmentName, options: environmentOptions },
    rpc,
    config,
  } = context

  // we could load @vite/env, but it would take ~8ms, while this takes ~0,02ms
  if (context.config.serializedDefines) {
    try {
      runInThisContext(`(() =>{\n${context.config.serializedDefines}})()`, {
        lineOffset: 1,
        filename: 'virtual:load-defines.js',
      })
    }
    catch (error: any) {
      throw new Error(`Failed to load custom "defines": ${error.message}`)
    }
  }
  const otel = context.traces

  const { environment, loader } = await loadEnvironment(environmentName, config.root, rpc, otel)
  _currentEnvironment = environment
  const env = await otel.$(
    'vitest.runtime.environment.setup',
    {
      attributes: {
        'vitest.environment': environment.name,
        'vitest.environment.vite_environment': environment.viteEnvironment || environment.name,
      },
    },
    () => environment.setup(globalThis, environmentOptions || config.environmentOptions || {}),
  )

  _environmentTime = performance.now() - startTime

  if (config.chaiConfig) {
    setupChaiConfig(config.chaiConfig)
  }

  return async () => {
    await otel.$(
      'vitest.runtime.environment.teardown',
      () => env.teardown(globalThis),
    )
    await loader?.close()
  }
}

/** @experimental */
export async function runBaseTests(method: 'run' | 'collect', state: WorkerGlobalState, traces: Traces): Promise<void> {
  const { ctx } = state
  state.environment = _currentEnvironment
  state.durations.environment = _environmentTime
  // state has new context, but we want to reuse existing ones
  state.evaluatedModules = evaluatedModules
  state.moduleExecutionInfo = moduleExecutionInfo

  provideWorkerState(globalThis, state)

  if (ctx.invalidates) {
    ctx.invalidates.forEach((filepath) => {
      const modules = state.evaluatedModules.fileToModulesMap.get(filepath) || []
      modules.forEach((module) => {
        state.evaluatedModules.invalidateModule(module)
      })
    })
  }
  ctx.files.forEach((i) => {
    const filepath = i.filepath
    const modules = state.evaluatedModules.fileToModulesMap.get(filepath) || []
    modules.forEach((module) => {
      state.evaluatedModules.invalidateModule(module)
    })
  })

  const moduleRunner = startModuleRunner({
    state,
    evaluatedModules: state.evaluatedModules,
    spyModule,
    createImportMeta: createNodeImportMeta,
    traces,
  })

  emitModuleRunner(moduleRunner as any)

  await run(
    method,
    ctx.files,
    ctx.config,
    moduleRunner,
    _currentEnvironment,
    traces,
  )
}
