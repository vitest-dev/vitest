import type { WorkerGlobalState } from '../../types/worker'
import type { VitestModuleRunner } from '../moduleRunner/moduleRunner'
import type { ContextExecutorOptions } from '../moduleRunner/startModuleRunner'
import { EvaluatedModules } from 'vite/module-runner'
import { startVitestModuleRunner } from '../moduleRunner/startModuleRunner'
import { provideWorkerState } from '../utils'

let _moduleRunner: VitestModuleRunner

const evaluatedModules = new EvaluatedModules()
const moduleExecutionInfo = new Map()

async function startModuleRunner(options: ContextExecutorOptions) {
  if (_moduleRunner) {
    return _moduleRunner
  }

  _moduleRunner = await startVitestModuleRunner(options)
  return _moduleRunner
}

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
      // evaluatedModules.delete(fsPath)
      // evaluatedModules.delete(`mock:${fsPath}`)
    })
  }
  ctx.files.forEach((i) => {
    const filepath = typeof i === 'string' ? i : i.filepath
    const modules = state.evaluatedModules.fileToModulesMap.get(filepath) || []
    modules.forEach((module) => {
      state.evaluatedModules.invalidateModule(module)
    })
  })

  const [executor, { run }] = await Promise.all([
    startModuleRunner({ state, evaluatedModules: state.evaluatedModules }),
    import('../runBaseTests'),
  ])
  const fileSpecs = ctx.files.map(f =>
    typeof f === 'string'
      ? { filepath: f, testLocations: undefined }
      : f,
  )

  await run(
    method,
    fileSpecs,
    ctx.config,
    { environment: state.environment, options: ctx.environment.options },
    executor,
  )
}
