import type { Context } from 'node:vm'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import { pathToFileURL } from 'node:url'
import { isContext, runInContext } from 'node:vm'
import { resolve } from 'pathe'
import { loadEnvironment } from '../../integrations/env/loader'
import { distDir } from '../../paths'
import { createCustomConsole } from '../console'
import { ExternalModulesExecutor } from '../external-executor'
import { emitModuleRunner } from '../listeners'
import { listenForErrors } from '../moduleRunner/errorCatcher'
import { getDefaultRequestStubs } from '../moduleRunner/moduleEvaluator'
import { createNodeImportMeta } from '../moduleRunner/moduleRunner'
import { startVitestModuleRunner, VITEST_VM_CONTEXT_SYMBOL } from '../moduleRunner/startVitestModuleRunner'
import { provideWorkerState } from '../utils'
import { FileMap } from '../vm/file-map'

const entryFile = pathToFileURL(resolve(distDir, 'workers/runVmTests.js')).href

const fileMap = new FileMap()
const packageCache = new Map<string, string>()

export async function runVmTests(method: 'run' | 'collect', state: WorkerGlobalState, traces: Traces): Promise<void> {
  const { ctx, rpc } = state

  const beforeEnvironmentTime = performance.now()
  const { environment } = await loadEnvironment(ctx.environment.name, ctx.config.root, rpc, traces, true)
  state.environment = environment

  if (!environment.setupVM) {
    const envName = ctx.environment.name
    const packageId
      = envName[0] === '.' ? envName : `vitest-environment-${envName}`
    throw new TypeError(
      `Environment "${ctx.environment.name}" is not a valid environment. `
      + `Path "${packageId}" doesn't support vm environment because it doesn't provide "setupVM" method.`,
    )
  }

  const vm = await traces.$(
    'vitest.runtime.environment.setup',
    {
      attributes: {
        'vitest.environment': environment.name,
        'vitest.environment.vite_environment': environment.viteEnvironment || environment.name,
      },
    },
    () => environment.setupVM!(ctx.environment.options || ctx.config.environmentOptions || {}),
  )

  state.durations.environment = performance.now() - beforeEnvironmentTime

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

  process.exit = (code = process.exitCode || 0): never => {
    throw new Error(`process.exit unexpectedly called with "${code}"`)
  }

  listenForErrors(() => state)

  const moduleRunner = startVitestModuleRunner({
    context,
    evaluatedModules: state.evaluatedModules,
    state,
    externalModulesExecutor,
    createImportMeta: createNodeImportMeta,
    traces,
  })

  emitModuleRunner(moduleRunner as any)

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

  if (ctx.config.serializedDefines) {
    try {
      runInContext(ctx.config.serializedDefines, context, {
        filename: 'virtual:load-defines.js',
      })
    }
    catch (error: any) {
      throw new Error(`Failed to load custom "defines": ${error.message}`)
    }
  }
  await moduleRunner.mocker.initializeSpyModule()

  const { run } = (await moduleRunner.import(
    entryFile,
  )) as typeof import('../runVmTests')

  try {
    await run(
      method,
      ctx.files,
      ctx.config,
      moduleRunner,
      traces,
    )
  }
  finally {
    await traces.$(
      'vitest.runtime.environment.teardown',
      () => vm.teardown?.(),
    )
  }
}

export function setupVmWorker(context: WorkerSetupContext): void {
  if (context.config.experimental.viteModuleRunner === false) {
    throw new Error(`Pool "${context.pool}" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
  }
}
