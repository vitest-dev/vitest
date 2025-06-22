import type { ViteNodeRunnerOptions } from 'vite-node'
import type { ModuleCacheMap, ModuleExecutionInfo } from 'vite-node/client'
import type { WorkerGlobalState } from '../types/worker'
import type { ExternalModulesExecutor } from './external-executor'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { processError } from '@vitest/utils/error'
import { normalize } from 'pathe'
import { DEFAULT_REQUEST_STUBS, ViteNodeRunner } from 'vite-node/client'
import {
  isInternalRequest,
  isNodeBuiltin,
  isPrimitive,
  toFilePath,
} from 'vite-node/utils'
import { distDir } from '../paths'
import { VitestMocker } from './mocker'

const normalizedDistDir = normalize(distDir)

const { readFileSync } = fs

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  moduleDirectories?: string[]
  state: WorkerGlobalState
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
}

export async function createVitestExecutor(options: ExecuteOptions): Promise<VitestExecutor> {
  const runner = new VitestExecutor(options)

  await runner.executeId('/@vite/env')
  await runner.mocker.initializeSpyModule()

  return runner
}

const externalizeMap = new Map<string, string>()

export interface ContextExecutorOptions {
  moduleCache?: ModuleCacheMap
  context?: vm.Context
  externalModulesExecutor?: ExternalModulesExecutor
  state: WorkerGlobalState
  requestStubs: Record<string, any>
}

const bareVitestRegexp = /^@?vitest(?:\/|$)/

const dispose: (() => void)[] = []

function listenForErrors(state: () => WorkerGlobalState) {
  dispose.forEach(fn => fn())
  dispose.length = 0

  function catchError(err: unknown, type: string, event: 'uncaughtException' | 'unhandledRejection') {
    const worker = state()

    const listeners = process.listeners(event as 'uncaughtException')
    // if there is another listener, assume that it's handled by user code
    // one is Vitest's own listener
    if (listeners.length > 1) {
      return
    }

    const error = processError(err)
    if (!isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.type === 'test' ? worker.current.name : undefined
      if (worker.filepath) {
        error.VITEST_TEST_PATH = worker.filepath
      }
      error.VITEST_AFTER_ENV_TEARDOWN = worker.environmentTeardownRun
    }
    state().rpc.onUnhandledError(error, type)
  }

  const uncaughtException = (e: Error) => catchError(e, 'Uncaught Exception', 'uncaughtException')
  const unhandledRejection = (e: Error) => catchError(e, 'Unhandled Rejection', 'unhandledRejection')

  process.on('uncaughtException', uncaughtException)
  process.on('unhandledRejection', unhandledRejection)

  dispose.push(() => {
    process.off('uncaughtException', uncaughtException)
    process.off('unhandledRejection', unhandledRejection)
  })
}

const relativeIds: Record<string, string> = {}

function getVitestImport(id: string, state: () => WorkerGlobalState) {
  if (externalizeMap.has(id)) {
    return { externalize: externalizeMap.get(id)! }
  }
  // always externalize Vitest because we import from there before running tests
  // so we already have it cached by Node.js
  const root = state().config.root
  const relativeRoot = relativeIds[root] ?? (relativeIds[root] = normalizedDistDir.slice(root.length))
  if (
    // full dist path
    id.includes(distDir)
    || id.includes(normalizedDistDir)
    // "relative" to root path:
    // /node_modules/.pnpm/vitest/dist
    || (relativeRoot && relativeRoot !== '/' && id.startsWith(relativeRoot))
  ) {
    const { path } = toFilePath(id, root)
    const externalize = pathToFileURL(path).toString()
    externalizeMap.set(id, externalize)
    return { externalize }
  }
  if (bareVitestRegexp.test(id)) {
    externalizeMap.set(id, id)
    return { externalize: id }
  }
  return null
}

export async function startVitestExecutor(options: ContextExecutorOptions): Promise<VitestExecutor> {
  const state = (): WorkerGlobalState =>
    // @ts-expect-error injected untyped global
    globalThis.__vitest_worker__ || options.state
  const rpc = () => state().rpc

  process.exit = (code = process.exitCode || 0): never => {
    throw new Error(`process.exit unexpectedly called with "${code}"`)
  }

  listenForErrors(state)

  const getTransformMode = () => {
    return state().environment.transformMode ?? 'ssr'
  }

  return await createVitestExecutor({
    async fetchModule(id) {
      const vitest = getVitestImport(id, state)
      if (vitest) {
        return vitest
      }

      const result = await rpc().fetch(id, getTransformMode())
      if (result.id && !result.externalize) {
        const code = readFileSync(result.id, 'utf-8')
        return { code }
      }
      return result
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer, getTransformMode())
    },
    get moduleCache() {
      return state().moduleCache as ModuleCacheMap
    },
    get moduleExecutionInfo() {
      return state().moduleExecutionInfo
    },
    get interopDefault() {
      return state().config.deps.interopDefault
    },
    get moduleDirectories() {
      return state().config.deps.moduleDirectories
    },
    get root() {
      return state().config.root
    },
    get base() {
      return state().config.base
    },
    ...options,
  })
}

function updateStyle(id: string, css: string) {
  if (typeof document === 'undefined') {
    return
  }

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
  if (typeof document === 'undefined') {
    return
  }
  const sheet = document.querySelector(`[data-vite-dev-id="${id}"]`)
  if (sheet) {
    document.head.removeChild(sheet)
  }
}

export function getDefaultRequestStubs(context?: vm.Context): {
  '/@vite/client': any
  '@vite/client': any
} {
  if (!context) {
    const clientStub = {
      ...DEFAULT_REQUEST_STUBS['@vite/client'],
      updateStyle,
      removeStyle,
    }
    return {
      '/@vite/client': clientStub,
      '@vite/client': clientStub,
    }
  }
  const clientStub = vm.runInContext(
    `(defaultClient) => ({ ...defaultClient, updateStyle: ${updateStyle.toString()}, removeStyle: ${removeStyle.toString()} })`,
    context,
  )(DEFAULT_REQUEST_STUBS['@vite/client'])
  return {
    '/@vite/client': clientStub,
    '@vite/client': clientStub,
  }
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
      this.primitives = { Object, Reflect, Symbol }
    }
    else if (options.externalModulesExecutor) {
      this.primitives = vm.runInContext(
        '({ Object, Reflect, Symbol })',
        options.context,
      )
      this.externalModules = options.externalModulesExecutor
    }
    else {
      throw new Error(
        'When context is provided, externalModulesExecutor must be provided as well.',
      )
    }
  }

  protected getContextPrimitives(): {
    Object: typeof Object
    Reflect: typeof Reflect
    Symbol: typeof Symbol
  } {
    return this.primitives
  }

  get state(): WorkerGlobalState {
    // @ts-expect-error injected untyped global
    return globalThis.__vitest_worker__ || this.options.state
  }

  get moduleExecutionInfo(): ModuleExecutionInfo | undefined {
    return this.options.moduleExecutionInfo
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id) || id.startsWith('data:')) {
      return false
    }
    const transformMode = this.state.environment?.transformMode ?? 'ssr'
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return transformMode === 'ssr'
      ? !isNodeBuiltin(id)
      : !id.startsWith('node:')
  }

  async originalResolveUrl(id: string, importer?: string): Promise<[url: string, fsPath: string]> {
    return super.resolveUrl(id, importer)
  }

  async resolveUrl(id: string, importer?: string): Promise<[url: string, fsPath: string]> {
    if (VitestMocker.pendingIds.length) {
      await this.mocker.resolveMocks()
    }

    if (importer && importer.startsWith('mock:')) {
      importer = importer.slice(5)
    }
    try {
      return await super.resolveUrl(id, importer)
    }
    catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        const { id } = error[Symbol.for('vitest.error.not_found.data')]
        const path = this.mocker.normalizePath(id)
        const mock = this.mocker.getDependencyMock(path)
        if (mock !== undefined) {
          return [id, id] as [string, string]
        }
      }
      throw error
    }
  }

  protected async runModule(context: Record<string, any>, transformed: string): Promise<void> {
    const vmContext = this.options.context

    if (!vmContext || !this.externalModules) {
      return super.runModule(context, transformed)
    }

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(
      ',',
    )})=>{{`
    const code = `${codeDefinition}${transformed}\n}}`
    const options = {
      filename: context.__filename,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    const finishModuleExecutionInfo = this.startCalculateModuleExecutionInfo(options.filename, codeDefinition.length)

    try {
      const fn = vm.runInContext(code, vmContext, {
        ...options,
        // if we encountered an import, it's not inlined
        importModuleDynamically: this.externalModules
          .importModuleDynamically as any,
      } as any)
      await fn(...Object.values(context))
    }
    finally {
      this.options.moduleExecutionInfo?.set(options.filename, finishModuleExecutionInfo())
    }
  }

  public async importExternalModule(path: string): Promise<any> {
    if (this.externalModules) {
      return this.externalModules.import(path)
    }
    return super.importExternalModule(path)
  }

  async dependencyRequest(
    id: string,
    fsPath: string,
    callstack: string[],
  ): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string') {
      return super.dependencyRequest(mocked, mocked, callstack)
    }
    if (mocked && typeof mocked === 'object') {
      return mocked
    }
    return super.dependencyRequest(id, fsPath, callstack)
  }

  prepareContext(context: Record<string, any>): Record<string, any> {
    // support `import.meta.vitest` for test entry
    if (
      this.state.filepath
      && normalize(this.state.filepath) === normalize(context.__filename)
    ) {
      const globalNamespace = this.options.context || globalThis
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', {
        // @ts-expect-error injected untyped global
        get: () => globalNamespace.__vitest_index__,
      })
    }

    if (this.options.context && this.externalModules) {
      context.require = this.externalModules.createRequire(context.__filename)
    }

    return context
  }
}
