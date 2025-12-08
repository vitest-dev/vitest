import type { Environment } from '../../types/environment'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import type { ContextModuleRunnerOptions } from '../moduleRunner/startVitestModuleRunner'
import type { TestModuleRunner } from '../moduleRunner/testModuleRunner'
import module from 'node:module'
import { runInThisContext } from 'node:vm'
import { MessageChannel } from 'node:worker_threads'
import * as spyModule from '@vitest/spy'
import { setupChaiConfig } from '../../integrations/chai/config'
import { loadEnvironment } from '../../integrations/env/loader'
import { NativeModuleRunner } from '../../utils/nativeModuleRunner'
import { VitestEvaluatedModules } from '../moduleRunner/evaluatedModules'
import { createNodeImportMeta } from '../moduleRunner/moduleRunner'
import { startVitestModuleRunner } from '../moduleRunner/startVitestModuleRunner'
import { run } from '../runBaseTests'
import { provideWorkerState } from '../utils'

let _moduleRunner: TestModuleRunner

const evaluatedModules = new VitestEvaluatedModules()
const moduleExecutionInfo = new Map()

function startModuleRunner(options: ContextModuleRunnerOptions): TestModuleRunner {
  if (_moduleRunner) {
    return _moduleRunner
  }

  if (options.state.config.experimental.viteModuleRunner === false) {
    _moduleRunner = new NativeModuleRunner(options.state.config.root)
    return _moduleRunner
  }

  _moduleRunner = startVitestModuleRunner(options)
  return _moduleRunner
}

let _currentEnvironment!: Environment
let _environmentTime: number

/** @experimental */
export async function setupBaseEnvironment(context: WorkerSetupContext): Promise<() => Promise<void>> {
  if (context.config.experimental.viteModuleRunner) {
    setupNodeLoaderHooks(context)
  }

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

function setupNodeLoaderHooks(worker: WorkerSetupContext) {
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context)
        // avoid node_modules for performance reasons
        if (context.parentURL && result.url && !result.url.includes('/node_modules/')) {
          worker.rpc.ensureModuleGraphEntry(result.url, context.parentURL).catch(() => {
            // ignore the errors if any
          })
        }
        return result
      },
    })
  }
  else if (module.register) {
    const { port1, port2 } = new MessageChannel()
    port1.unref()
    port2.unref()
    port1.on('message', (data) => {
      if (!data || typeof data !== 'object') {
        return
      }
      switch (data.event) {
        case 'register-module-graph-entry': {
          const { url, parentURL } = data
          worker.rpc.ensureModuleGraphEntry(url, parentURL)
          return
        }
        default: {
          console.error('Unknown message event:', data.event)
        }
      }
    })
    module.register('#test-loader', {
      parentURL: import.meta.url,
      data: { port: port2 },
      transferList: [port2],
    })
  }
  else if (!process.versions.deno && !process.versions.bun) {
    console.warn(
      '"module.registerHooks" and "module.register" are not supported. Some Vitest features may not work. Please, use Node.js 18.19.0 or higher.',
    )
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

  await run(
    method,
    ctx.files,
    ctx.config,
    moduleRunner,
    _currentEnvironment,
    traces,
  )
}
