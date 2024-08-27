import type { Context } from 'node:vm'
import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { isContext } from 'node:vm'
import { resolve } from 'pathe'
import { distDir } from '../../paths'
import { createCustomConsole } from '../console'
import { getDefaultRequestStubs, startVitestExecutor } from '../execute'
import { ExternalModulesExecutor } from '../external-executor'
import { provideWorkerState } from '../utils'
import { FileMap } from '../vm/file-map'

const entryFile = pathToFileURL(resolve(distDir, 'workers/runVmTests.js')).href

const fileMap = new FileMap()
const packageCache = new Map<string, string>()

export async function runVmTests(method: 'run' | 'collect', state: WorkerGlobalState) {
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

  const executor = await startVitestExecutor({
    context,
    moduleCache: state.moduleCache,
    state,
    externalModulesExecutor,
    requestStubs: stubs,
  })

  context.__vitest_mocker__ = executor.mocker

  const { run } = (await executor.importExternalModule(
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
      executor,
    )
  }
  finally {
    await vm.teardown?.()
    state.environmentTeardownRun = true
  }
}
