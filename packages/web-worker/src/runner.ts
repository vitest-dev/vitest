import type { VitestModuleRunner } from 'vitest/internal/module-runner'
import {
  getWorkerState,
  startVitestModuleRunner,
  VITEST_VM_CONTEXT_SYMBOL,
  VitestModuleEvaluator,
} from 'vitest/internal/module-runner'

export function startWebWorkerModuleRunner(context: Record<string, unknown>): VitestModuleRunner {
  const state = getWorkerState()
  const mocker = (globalThis as any).__vitest_mocker__

  const compiledFunctionArgumentsNames = Object.keys(context)
  const compiledFunctionArgumentsValues = Object.values(context)
  compiledFunctionArgumentsNames.push('importScripts')
  compiledFunctionArgumentsValues.push(importScripts)

  const vm = (globalThis as any)[VITEST_VM_CONTEXT_SYMBOL]

  const evaluator = new VitestModuleEvaluator(vm, {
    interopDefault: state.config.deps.interopDefault,
    moduleExecutionInfo: state.moduleExecutionInfo,
    getCurrentTestFilepath: () => state.filepath,
    compiledFunctionArgumentsNames,
    compiledFunctionArgumentsValues,
  })

  return startVitestModuleRunner({
    evaluator,
    evaluatedModules: state.evaluatedModules,
    mocker,
    state,
  })
}

function importScripts() {
  throw new Error(
    '[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.',
  )
}
