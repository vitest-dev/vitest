import type { WorkerGlobalState } from '../../types/worker'
import type { VitestModuleRunner } from '../moduleRunner/moduleRunner'
import type { ContextModuleRunnerOptions } from '../moduleRunner/startModuleRunner'
import { runInThisContext } from 'node:vm'
import * as spyModule from '@vitest/spy'
import { EvaluatedModules } from 'vite/module-runner'
import { createNodeImportMeta } from '../moduleRunner/moduleRunner'
import { startVitestModuleRunner } from '../moduleRunner/startModuleRunner'
import { run } from '../runBaseTests'
import { provideWorkerState } from '../utils'

let _moduleRunner: VitestModuleRunner

const evaluatedModules = new EvaluatedModules()
const moduleExecutionInfo = new Map()

function startModuleRunner(options: ContextModuleRunnerOptions) {
  if (_moduleRunner) {
    return _moduleRunner
  }

  _moduleRunner = startVitestModuleRunner(options)
  return _moduleRunner
}

/** @experimental */
export async function runBaseTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
  const { ctx } = state
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
    const filepath = typeof i === 'string' ? i : i.filepath
    const modules = state.evaluatedModules.fileToModulesMap.get(filepath) || []
    modules.forEach((module) => {
      state.evaluatedModules.invalidateModule(module)
    })
  })

  const executor = startModuleRunner({
    state,
    evaluatedModules: state.evaluatedModules,
    spyModule,
    createImportMeta: createNodeImportMeta,
  })
  const fileSpecs = ctx.files.map(f =>
    typeof f === 'string'
      ? { filepath: f, testLocations: undefined }
      : f,
  )
  // we could load @vite/env, but it would take ~8ms, while this takes ~0,02ms
  if (ctx.config.serializedDefines) {
    try {
      runInThisContext(`(() =>{\n${ctx.config.serializedDefines}})()`, {
        lineOffset: 1,
        filename: 'virtual:load-defines.js',
      })
    }
    catch (error: any) {
      throw new Error(`Failed to load custom "defines": ${error.message}`)
    }
  }

  await run(
    method,
    fileSpecs,
    ctx.config,
    { environment: state.environment, options: ctx.environment.options },
    executor,
  )
}
