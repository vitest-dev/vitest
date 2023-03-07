import { pathToFileURL } from 'node:url'
import { ModuleCacheMap, ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest, isPrimitive } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import { normalize, relative, resolve } from 'pathe'
import { isNodeBuiltin } from 'mlly'
import { processError } from '@vitest/runner/utils'
import type { MockMap } from '../types/mocker'
import { getCurrentEnvironment, getWorkerState } from '../utils/global'
import type { ContextRPC, ContextTestEnvironment, ResolvedConfig } from '../types'
import { distDir } from '../constants'
import { VitestMocker } from './mocker'
import { rpc } from './rpc'

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
}

export async function createVitestExecutor(options: ExecuteOptions) {
  const runner = new VitestExecutor(options)

  await runner.executeId('/@vite/env')

  return runner
}

let _viteNode: {
  run: (files: string[], config: ResolvedConfig, environment: ContextTestEnvironment, executor: VitestExecutor) => Promise<void>
  executor: VitestExecutor
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
    if (worker.filepath && !isPrimitive(error)) {
      error.VITEST_TEST_NAME = worker.current?.name
      error.VITEST_TEST_PATH = relative(config.root, worker.filepath)
    }
    rpc().onUnhandledError(error, type)
  }

  process.on('uncaughtException', e => catchError(e, 'Uncaught Exception'))
  process.on('unhandledRejection', e => catchError(e, 'Unhandled Rejection'))

  const executor = await createVitestExecutor({
    fetchModule(id) {
      return rpc().fetch(id, ctx.environment.name)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer, ctx.environment.name)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault,
    root: config.root,
    base: config.base,
  })

  const { run } = await import(pathToFileURL(resolve(distDir, 'entry.js')).href)

  _viteNode = { run, executor }

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
    if (isInternalRequest(id))
      return false
    const environment = getCurrentEnvironment()
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return environment === 'node' ? !isNodeBuiltin(id) : !id.startsWith('node:')
  }

  async resolveUrl(id: string, importer?: string) {
    if (importer && importer.startsWith('mock:'))
      importer = importer.slice(5)
    return super.resolveUrl(id, importer)
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
