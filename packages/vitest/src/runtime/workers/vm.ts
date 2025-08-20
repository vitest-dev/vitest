import type { Context } from 'node:vm'
import type { WorkerContext } from '../../node/types/worker'
import type { ContextRPC, WorkerGlobalState } from '../../types/worker'
import type { VitestWorker, WorkerRpcOptions } from './types'
import { pathToFileURL } from 'node:url'
import v8 from 'node:v8'
import { isContext } from 'node:vm'
import { resolve } from 'pathe'
import { distDir } from '../../paths'
import { createCustomConsole } from '../console'
import { getDefaultRequestStubs } from '../moduleRunner/moduleEvaluator'
import { startVitestModuleRunner, VITEST_VM_CONTEXT_SYMBOL } from '../moduleRunner/startModuleRunner'
import { provideWorkerState } from '../utils'
import { ExternalModulesExecutor } from '../vm/external-executor'
import { FileMap } from '../vm/file-map'
import * as entry from '../worker'
import { createForksRpcOptions, createThreadsRpcOptions, unwrapSerializableConfig } from './utils'

export async function run(ctx: ContextRPC): Promise<void> {
  const worker = ctx.pool === 'vmForks' ? new ForksVmWorker() : new ThreadsVmWorker()
  await entry.run(ctx, worker)
}

export async function collect(ctx: ContextRPC): Promise<void> {
  const worker = ctx.pool === 'vmForks' ? new ForksVmWorker() : new ThreadsVmWorker()
  await entry.collect(ctx, worker)
}

export async function teardown(): Promise<void> {
  await entry.teardown()
}

const entryFile = pathToFileURL(resolve(distDir, 'workers/runVmTests.js')).href

const fileMap = new FileMap()
const packageCache = new Map<string, string>()

export async function runVmTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
  const { environment, ctx, rpc } = state

  if (!environment.setupVM) {
    const envName = ctx.environment.name
    const packageId
      = envName[0] === '.' ? envName : `vitest-environment-${envName}`
    throw new TypeError(
      `Environment "${ctx.environment.name}" is not a valid environment. `
      + `Path "${packageId}" doesn't support vm environment because it doesn't provide "setupVM" method.`,
    )
  }

  const vm = await environment.setupVM(
    ctx.environment.options || ctx.config.environmentOptions || {},
  )

  state.durations.environment = performance.now() - state.durations.environment

  process.env.VITEST_VM_POOL = '1'

  if (!vm.getVmContext) {
    throw new TypeError(
      `Environment ${environment.name} doesn't provide "getVmContext" method. It should return a context created by "vm.createContext" method.`,
    )
  }

  const context: Context | null = vm.getVmContext()

  if (!isContext(context)) {
    throw new TypeError(
      `Environment ${environment.name} doesn't provide a valid context. It should be created by "vm.createContext" method.`,
    )
  }

  provideWorkerState(context, state)

  // this is unfortunately needed for our own dependencies
  // we need to find a way to not rely on this by default
  // because browser doesn't provide these globals
  context.process = process
  context.global = context
  context.console = state.config.disableConsoleIntercept
    ? console
    : createCustomConsole(state)
  // TODO: don't hardcode setImmediate in fake timers defaults
  context.setImmediate = setImmediate
  context.clearImmediate = clearImmediate

  const stubs = getDefaultRequestStubs(context)

  const externalModulesExecutor = new ExternalModulesExecutor({
    context,
    fileMap,
    packageCache,
    transform: rpc.transform,
    viteClientModule: stubs['/@vite/client'],
  })

  const moduleRunner = startVitestModuleRunner({
    context,
    evaluatedModules: state.evaluatedModules,
    state,
    externalModulesExecutor,
  })
  await moduleRunner.mocker.initializeSpyModule()

  Object.defineProperty(context, VITEST_VM_CONTEXT_SYMBOL, {
    value: {
      context,
      externalModulesExecutor,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  })
  context.__vitest_mocker__ = moduleRunner.mocker

  const { run } = (await moduleRunner.import(
    entryFile,
  )) as typeof import('../runVmTests')
  const fileSpecs = ctx.files.map(f =>
    typeof f === 'string'
      ? { filepath: f, testLocations: undefined }
      : f,
  )

  try {
    await run(
      method,
      fileSpecs,
      ctx.config,
      moduleRunner,
    )
  }
  finally {
    await vm.teardown?.()
    state.environmentTeardownRun = true
  }
}

class ForksVmWorker implements VitestWorker {
  getRpcOptions(): WorkerRpcOptions {
    return createForksRpcOptions(v8)
  }

  async executeTests(method: 'run' | 'collect', state: WorkerGlobalState): Promise<void> {
    const exit = process.exit
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runVmTests(method, state)
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

class ThreadsVmWorker implements VitestWorker {
  getRpcOptions(ctx: ContextRPC): WorkerRpcOptions {
    return createThreadsRpcOptions(ctx as WorkerContext)
  }

  runTests(state: WorkerGlobalState): unknown {
    return runVmTests('run', state)
  }

  collectTests(state: WorkerGlobalState): unknown {
    return runVmTests('collect', state)
  }
}
