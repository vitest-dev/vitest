import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { DEFAULT_REQUEST_STUBS, ModuleCacheMap, ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest, isNodeBuiltin, isPrimitive, toFilePath } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import { normalize, relative, resolve } from 'pathe'
import { processError } from '@vitest/utils/error'
import type { MockMap } from '../types/mocker'
import type { ResolvedConfig, ResolvedTestEnvironment, RuntimeRPC, WorkerGlobalState } from '../types'
import { distDir } from '../paths'
import { VitestMocker } from './mocker'
import { ExternalModulesExecutor } from './external-executor'
import { FileMap } from './vm/file-map'

const entryUrl = pathToFileURL(resolve(distDir, 'entry.js')).href

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
  packageCache: Map<string, string>
  moduleDirectories?: string[]
  context?: vm.Context
  state: WorkerGlobalState
  transform: RuntimeRPC['transform']
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
}

export const packageCache = new Map<string, any>()
export const moduleCache = new ModuleCacheMap()
export const mockMap: MockMap = new Map()
export const fileMap = new FileMap()
const externalizeMap = new Map<string, string>()

export async function startViteNode(options: ContextExecutorOptions) {
  if (_viteNode)
    return _viteNode

  const executor = await startVitestExecutor(options)

  const { run } = await import(entryUrl)

  _viteNode = { run, executor }

  return _viteNode
}

export interface ContextExecutorOptions {
  mockMap?: MockMap
  moduleCache?: ModuleCacheMap
  context?: vm.Context
  state: WorkerGlobalState
}

const bareVitestRegexp = /^@?vitest(\/|$)/

export async function startVitestExecutor(options: ContextExecutorOptions) {
  // @ts-expect-error injected untyped global
  const state = (): WorkerGlobalState => globalThis.__vitest_worker__ || options.state
  const rpc = () => state().rpc

  const processExit = process.exit

  process.exit = (code = process.exitCode || 0): never => {
    const error = new Error(`process.exit called with "${code}"`)
    rpc().onWorkerExit(error, code)
    return processExit(code)
  }

  function catchError(err: unknown, type: string) {
    const worker = state()
    const error = processError(err)
    if (!isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      if (worker.filepath)
        error.VITEST_TEST_PATH = relative(state().config.root, worker.filepath)
      error.VITEST_AFTER_ENV_TEARDOWN = worker.environmentTeardownRun
    }
    rpc().onUnhandledError(error, type)
  }

  process.setMaxListeners(25)

  process.on('uncaughtException', e => catchError(e, 'Uncaught Exception'))
  process.on('unhandledRejection', e => catchError(e, 'Unhandled Rejection'))

  const getTransformMode = () => {
    return state().environment.transformMode ?? 'ssr'
  }

  return await createVitestExecutor({
    async fetchModule(id) {
      if (externalizeMap.has(id))
        return { externalize: externalizeMap.get(id)! }
      // always externalize Vitest because we import from there before running tests
      // so we already have it cached by Node.js
      if (id.includes(distDir)) {
        const { path } = toFilePath(id, state().config.root)
        const externalize = pathToFileURL(path).toString()
        externalizeMap.set(id, externalize)
        return { externalize }
      }
      if (bareVitestRegexp.test(id)) {
        externalizeMap.set(id, id)
        return { externalize: id }
      }

      return rpc().fetch(id, getTransformMode())
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer, getTransformMode())
    },
    transform(id) {
      return rpc().transform(id, 'web')
    },
    packageCache,
    moduleCache,
    mockMap,
    get interopDefault() { return state().config.deps.interopDefault },
    get moduleDirectories() { return state().config.deps.moduleDirectories },
    get root() { return state().config.root },
    get base() { return state().config.base },
    ...options,
  })
}

function updateStyle(id: string, css: string) {
  if (typeof document === 'undefined')
    return

  const element = document.querySelector(`[data-vite-dev-id="${id}"]`)
  if (element) {
    element.textContent = css
    return
  }

  const head = document.querySelector('head')
  const style = document.createElement('style')
  style.setAttribute('type', 'text/css')
  style.setAttribute('data-vite-dev-id', id)
  style.textContent = css
  head?.appendChild(style)
}

function removeStyle(id: string) {
  if (typeof document === 'undefined')
    return
  const sheet = document.querySelector(`[data-vite-dev-id="${id}"]`)
  if (sheet)
    document.head.removeChild(sheet)
}

export class VitestExecutor extends ViteNodeRunner {
  public mocker: VitestMocker
  public externalModules?: ExternalModulesExecutor

  private primitives: {
    Object: typeof Object
    Reflect: typeof Reflect
    Symbol: typeof Symbol
  }

  constructor(public options: ExecuteOptions) {
    super({
      ...options,
      // interop is done inside the external executor instead
      interopDefault: options.context ? false : options.interopDefault,
    })

    this.mocker = new VitestMocker(this)

    if (!options.context) {
      Object.defineProperty(globalThis, '__vitest_mocker__', {
        value: this.mocker,
        writable: true,
        configurable: true,
      })
      const clientStub = { ...DEFAULT_REQUEST_STUBS['@vite/client'], updateStyle, removeStyle }
      this.options.requestStubs = {
        '/@vite/client': clientStub,
        '@vite/client': clientStub,
      }
      this.primitives = {
        Object,
        Reflect,
        Symbol,
      }
    }
    else {
      const clientStub = vm.runInContext(
        `(defaultClient) => ({ ...defaultClient, updateStyle: ${updateStyle.toString()}, removeStyle: ${removeStyle.toString()} })`,
        options.context,
      )(DEFAULT_REQUEST_STUBS['@vite/client'])
      this.options.requestStubs = {
        '/@vite/client': clientStub,
        '@vite/client': clientStub,
      }
      this.primitives = vm.runInContext('({ Object, Reflect, Symbol })', options.context)
      this.externalModules = new ExternalModulesExecutor({
        ...options,
        fileMap,
        context: options.context,
        packageCache: options.packageCache,
      })
    }
  }

  protected getContextPrimitives() {
    return this.primitives
  }

  get state() {
    // @ts-expect-error injected untyped global
    return globalThis.__vitest_worker__ || this.options.state
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id) || id.startsWith('data:'))
      return false
    const transformMode = this.state.environment?.transformMode ?? 'ssr'
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return transformMode === 'ssr' ? !isNodeBuiltin(id) : !id.startsWith('node:')
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
    // support `import.meta.vitest` for test entry
    if (this.state.filepath && normalize(this.state.filepath) === normalize(context.__filename)) {
      const globalNamespace = this.options.context || globalThis
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalNamespace.__vitest_index__ })
    }

    if (this.options.context && this.externalModules)
      context.require = this.externalModules.createRequire(context.__filename)

    return context
  }
}
