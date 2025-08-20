import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestModuleRunner } from '../moduleRunner/moduleRunner'
import type { ContextModuleRunnerOptions } from '../moduleRunner/startModuleRunner'
import type { VitestWorker, WorkerRpcOptions } from './types'
import v8 from 'node:v8'
import * as spyModule from '@vitest/spy'
import { EvaluatedModules } from 'vite/module-runner'
import { startVitestModuleRunner } from '../moduleRunner/startModuleRunner'
import { executeTests } from '../runBaseTests'
import { provideWorkerState } from '../utils'
import * as entry from '../worker'
import { createForksRpcOptions, createThreadsRpcOptions, unwrapSerializableConfig } from './utils'

export async function run(ctx: ContextRPC): Promise<void> {
  const worker = ctx.pool === 'forks' ? new ForksBaseWorker() : new ThreadsBaseWorker()
  await entry.run(ctx, worker)
}

export async function collect(ctx: ContextRPC): Promise<void> {
  const worker = ctx.pool === 'forks' ? new ForksBaseWorker() : new ThreadsBaseWorker()
  await entry.collect(ctx, worker)
}

export async function teardown(): Promise<void> {
  await entry.teardown()
}

let _moduleRunner: VitestModuleRunner

const evaluatedModules = new EvaluatedModules()
const moduleExecutionInfo = new Map()

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

  const moduleRunner = await startModuleRunner({
    state,
    evaluatedModules: state.evaluatedModules,
    spyModule,
  })
  const fileSpecs = ctx.files.map(f =>
    typeof f === 'string'
      ? { filepath: f, testLocations: undefined }
      : f,
  )

  await executeTests(
    method,
    fileSpecs,
    ctx.config,
    { environment: state.environment, options: ctx.environment.options },
    moduleRunner,
  )
}

async function startModuleRunner(options: ContextModuleRunnerOptions) {
  if (_moduleRunner) {
    return _moduleRunner
  }

  _moduleRunner = startVitestModuleRunner(options)
  return _moduleRunner
}

class ThreadsBaseWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC): WorkerRpcOptions {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runBaseTests('run', state)
  }

  collectTests(state: WorkerGlobalState): unknown {
    return runBaseTests('collect', state)
  }
}

class ForksBaseWorker implements VitestWorker {
  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
    // TODO: don't rely on reassigning process.exit
    // https://github.com/vitest-dev/vitest/pull/4441#discussion_r1443771486
    const exit = process.exit
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runBaseTests(method, state)
    }
    finally {
      process.exit = exit
    }
  }

  runTests(state: WorkerGlobalState): Promise<void> {
    return this.executeTests('run', state)
  }

  collectTests(state: WorkerGlobalState): Promise<void> {
    return this.executeTests('collect', state)
  }
}
