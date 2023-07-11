import { pathToFileURL } from 'node:url'
import { ModuleCacheMap, ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest, isNodeBuiltin, isPrimitive } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import { normalize, relative, resolve } from 'pathe'
import { processError } from '@vitest/utils/error'
import type { MockMap } from '../types/mocker'
import { getCurrentEnvironment, getWorkerState } from '../utils/global'
import type { ContextRPC, Environment, ResolvedConfig, ResolvedTestEnvironment } from '../types'
import { distDir } from '../paths'
import { loadEnvironment } from '../integrations/env'
import { VitestMocker } from './mocker'
import { rpc } from './rpc'

const entryUrl = pathToFileURL(resolve(distDir, 'entry.js')).href

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
  moduleDirectories?: string[]
}

export async function createVitestExecutor(options: ExecuteOptions) {
  const runner = new VitestExecutor(options)

  await runner.executeId('/@vite/env')

  return runner
}

let _viteNode: {
  run: (files: string[], config: ResolvedConfig, environment: ResolvedTestEnvironment, executor: VitestExecutor) => Promise<void>
  executor: VitestExecutor
  environment: Environment
}

export const moduleCache = new ModuleCacheMap()
export const mockMap: MockMap = new Map()

export async function startViteNode(ctx: ContextRPC) {
  if (_viteNode)
    return _viteNode

  const { config } = ctx

  const processExit = process.exit

  process.exit = (code = process.exitCode || 0): never => {
    const error = new Error(`process.exit called with "${code}"`)
    rpc().onWorkerExit(error, code)
    return processExit(code)
  }

  function catchError(err: unknown, type: string) {
    const worker = getWorkerState()
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

  let transformMode: 'ssr' | 'web' = ctx.environment.transformMode ?? 'ssr'

  const executor = await createVitestExecutor({
    fetchModule(id) {
      return rpc().fetch(id, transformMode)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer, transformMode)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault,
    moduleDirectories: config.deps.moduleDirectories,
    root: config.root,
    base: config.base,
  })

  const environment = await loadEnvironment(ctx.environment.name, executor)
  ctx.environment.environment = environment
  transformMode = ctx.environment.transformMode ?? environment.transformMode ?? 'ssr'

  const { run } = await import(entryUrl)

  _viteNode = { run, executor, environment }

  return _viteNode
}

export class VitestExecutor extends ViteNodeRunner {
  public mocker: VitestMocker

  constructor(public options: ExecuteOptions) {
    super(options)

    this.mocker = new VitestMocker(this)

    Object.defineProperty(globalThis, '__vitest_mocker__', {
      value: this.mocker,
      writable: true,
      configurable: true,
    })
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id) || id.startsWith('data:'))
      return false
    const environment = getCurrentEnvironment()
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

  async dependencyRequest(id: string, fsPath: string, callstack: string[]): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string')
      return super.dependencyRequest(mocked, mocked, callstack)
    if (mocked && typeof mocked === 'object')
      return mocked
    return super.dependencyRequest(id, fsPath, callstack)
  }

  prepareContext(context: Record<string, any>) {
    const workerState = getWorkerState()

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalize(workerState.filepath) === normalize(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    return context
  }
}
