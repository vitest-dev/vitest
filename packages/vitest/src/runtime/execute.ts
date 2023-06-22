import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { ModuleCacheMap, ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest, isNodeBuiltin, isPrimitive } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import { normalize, relative, resolve } from 'pathe'
import { processError } from '@vitest/utils/error'
import type { MockMap } from '../types/mocker'
import type { ContextRPC, Environment, ResolvedConfig, ResolvedTestEnvironment, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { loadEnvironment } from '../integrations/env'
import { getWorkerState } from '../utils/global'
import { VitestMocker } from './mocker'
import { ExternalModulesExecutor } from './external-executor'

const entryUrl = pathToFileURL(resolve(distDir, 'entry.js')).href

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
  moduleDirectories?: string[]
  context?: vm.Context
  state: WorkerGlobalState
}

export async function createVitestExecutor(options: ExecuteOptions) {
  const runner = new VitestExecutor(options)

  await runner.executeId('/@vite/env')
  await runner.mocker.initializeSpyModule()

  return runner
}

let _viteNode: {
  run: (files: string[], config: ResolvedConfig, environment: ResolvedTestEnvironment, executor: VitestExecutor) => Promise<void>
  executor: VitestExecutor
  environment: Environment
}

export const moduleCache = new ModuleCacheMap()
export const mockMap: MockMap = new Map()

export async function startViteNode(ctx: ContextRPC, options: ContextExecutorOptions) {
  if (_viteNode)
    return _viteNode

  const executor = await startVitestExecutor(ctx, options)

  const environment = await loadEnvironment(ctx.environment.name, executor)
  ctx.environment.environment = environment

  const { run } = await import(entryUrl)

  _viteNode = { run, executor, environment }

  return _viteNode
}

export interface ContextExecutorOptions {
  mockMap?: MockMap
  moduleCache?: ModuleCacheMap
  context?: vm.Context
  state: WorkerGlobalState
}

export async function startVitestExecutor(ctx: ContextRPC, options: ContextExecutorOptions) {
  const { config } = ctx

  const rpc = () => getWorkerState()?.rpc || options.state.rpc

  const processExit = process.exit

  process.exit = (code = process.exitCode || 0): never => {
    const error = new Error(`process.exit called with "${code}"`)
    rpc().onWorkerExit(error, code)
    return processExit(code)
  }

  function catchError(err: unknown, type: string) {
    const worker = options.state
    const error = processError(err)
    if (!isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      if (worker.filepath)
        error.VITEST_TEST_PATH = relative(config.root, worker.filepath)
      error.VITEST_AFTER_ENV_TEARDOWN = worker.environmentTeardownRun
    }
    rpc().onUnhandledError(error, type)
  }

  process.on('uncaughtException', e => catchError(e, 'Uncaught Exception'))
  process.on('unhandledRejection', e => catchError(e, 'Unhandled Rejection'))

  const getTransformMode = () => {
    return ctx.environment.transformMode ?? ctx.environment.environment?.transformMode ?? 'ssr'
  }

  return await createVitestExecutor({
    fetchModule(id) {
      return rpc().fetch(id, getTransformMode())
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer, getTransformMode())
    },
    moduleCache,
    mockMap,
    get interopDefault() { return config.deps.interopDefault },
    get moduleDirectories() { return config.deps.moduleDirectories },
    get root() { return config.root },
    get base() { return config.base },
    ...options,
  })
}

export class VitestExecutor extends ViteNodeRunner {
  public mocker: VitestMocker
  public externalModules?: ExternalModulesExecutor

  constructor(public options: ExecuteOptions) {
    super(options)

    this.mocker = new VitestMocker(this)

    if (!options.context) {
      Object.defineProperty(globalThis, '__vitest_mocker__', {
        value: this.mocker,
        writable: true,
        configurable: true,
      })
    }
    else {
      this.externalModules = new ExternalModulesExecutor(options.context)
    }
  }

  get state() {
    return this.options.state
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id) || id.startsWith('data:'))
      return false
    const environment = this.options.state.environment
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return environment === 'node' ? !isNodeBuiltin(id) : !id.startsWith('node:')
  }

  async originalResolveUrl(id: string, importer?: string) {
    return super.resolveUrl(id, importer)
  }

  async resolveUrl(id: string, importer?: string) {
    if (VitestMocker.pendingIds.length)
      await this.mocker.resolveMocks()

    if (importer && importer.startsWith('mock:'))
      importer = importer.slice(5)
    try {
      return await super.resolveUrl(id, importer)
    }
    catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        const { id } = error[Symbol.for('vitest.error.not_found.data')]
        const path = this.mocker.normalizePath(id)
        const mock = this.mocker.getDependencyMock(path)
        if (mock !== undefined)
          return [id, id] as [string, string]
      }
      throw error
    }
  }

  protected async runModule(context: Record<string, any>, transformed: string) {
    const vmContext = this.options.context

    if (!vmContext || !this.externalModules)
      return super.runModule(context, transformed)

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(',')})=>{{`
    const code = `${codeDefinition}${transformed}\n}}`
    const options = {
      filename: context.__filename,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    const fn = vm.runInContext(code, vmContext, {
      ...options,
      // if we encountered an import, it's not inlined
      importModuleDynamically: this.externalModules.importModuleDynamically as any,
    } as any)
    await fn(...Object.values(context))
  }

  public async importExternalModule(path: string): Promise<any> {
    if (this.externalModules)
      return this.externalModules.import(path)
    return super.importExternalModule(path)
  }

  async dependencyRequest(id: string, fsPath: string, callstack: string[]): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string')
      return super.dependencyRequest(mocked, mocked, callstack)
    if (mocked && typeof mocked === 'object')
      return mocked
    return super.dependencyRequest(id, fsPath, callstack)
  }

  prepareContext(context: Record<string, any>) {
    const workerState = this.state

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalize(workerState.filepath) === normalize(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    if (this.options.context && this.externalModules)
      context.require = this.externalModules.createRequire(context.__filename)

    return context
  }
}
