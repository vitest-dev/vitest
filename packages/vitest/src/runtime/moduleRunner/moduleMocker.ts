import type { ManualMockedModule, MockedModule, ModuleMockContext } from '@vitest/mocker'
import type { EvaluatedModuleNode } from 'vite/module-runner'
import type { BareModuleMockerOptions } from './bareModuleMocker'
import type { VitestModuleRunner } from './moduleRunner'
import { AsyncLocalStorage } from 'node:async_hooks'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { AutomockedModule, RedirectedModule } from '@vitest/mocker'
import { distDir } from '../../paths'
import { BareModuleMocker } from './bareModuleMocker'
import { injectQuery } from './utils'

const spyModulePath = resolve(distDir, 'spy.js')

export interface VitestMockerOptions extends BareModuleMockerOptions {
  context?: vm.Context
}

interface FactoryContext {
  mockId: string
  callstack: string[]
}

interface PendingFactory {
  promise: Promise<any>
  // ids of modules and mocks that wait for this factory
  waiting: Set<string>
}

export class VitestMocker extends BareModuleMocker {
  private filterPublicKeys: (symbol | string)[]
  // factories that run in the current async context, the innermost is last
  private factoryContexts = new AsyncLocalStorage<FactoryContext[]>()
  private pendingFactories = new Map<string, PendingFactory>()
  private waitListeners = new Set<() => void>()

  constructor(
    public moduleRunner: VitestModuleRunner,
    protected options: VitestMockerOptions,
  ) {
    super(options)

    const context = this.options.context
    if (context) {
      this.primitives = vm.runInContext(
        '({ Object, Error, Function, RegExp, Symbol, Array, Map })',
        context,
      )
    }

    const Symbol = this.primitives.Symbol

    this.filterPublicKeys = [
      '__esModule',
      Symbol.asyncIterator,
      Symbol.hasInstance,
      Symbol.isConcatSpreadable,
      Symbol.iterator,
      Symbol.match,
      Symbol.matchAll,
      Symbol.replace,
      Symbol.search,
      Symbol.split,
      Symbol.species,
      Symbol.toPrimitive,
      Symbol.toStringTag,
      Symbol.unscopables,
    ]
  }

  private get evaluatedModules() {
    return this.moduleRunner.evaluatedModules
  }

  public async initializeSpyModule(): Promise<void> {
    if (this.spyModule) {
      return
    }

    this.spyModule = await this.moduleRunner.import(spyModulePath)
  }

  protected invalidateModuleById(id: string): void {
    const mockId = this.getMockPath(id)
    this.pendingFactories.delete(mockId)
    const node = this.evaluatedModules.getModuleById(mockId)
    if (node) {
      this.evaluatedModules.invalidateModule(node)
      node.mockedExports = undefined
    }
  }

  public getMockContext(): ModuleMockContext {
    const context = this.factoryContexts
      .getStore()
      ?.findLast((context) => this.pendingFactories.has(context.mockId))
    return { callstack: context?.callstack ?? null }
  }

  /**
   * Whether the factory of this mock runs in the current async context,
   * or waits for a factory that runs in it. Such imports get the original module.
   * The callstack cannot tell it: all imports from one module share the same array.
   */
  public isResolvingMock(mockId: string): boolean {
    if (!this.pendingFactories.has(mockId)) {
      return false
    }
    const factories = this.currentFactories()
    return factories.includes(mockId) || this.waitsForFactories(mockId, factories)
  }

  /**
   * Whether the module is still evaluating and waits for a factory
   * that runs in the current async context.
   */
  public isWaitingForFactory(mod: EvaluatedModuleNode): boolean {
    return !!mod.promise && !mod.evaluated && this.waitsForFactories(mod.id)
  }

  /**
   * Waits for the module evaluation. If the module starts to wait
   * for a factory that waits for it, the factory gets the partial exports.
   */
  public awaitEvaluation<T>(mod: EvaluatedModuleNode, request: () => Promise<T>): Promise<T> {
    if (!mod.promise || mod.evaluated) {
      return request()
    }
    const factories = this.currentFactories()
    if (!factories.length) {
      return request()
    }
    let onWait!: () => void
    const cycle = new Promise<T>((resolve) => {
      onWait = () => {
        if (this.waitsForFactories(mod.id, factories)) {
          resolve(mod.exports as T)
        }
      }
    })
    this.waitListeners.add(onWait)
    return Promise.race([request(), cycle]).finally(() => this.waitListeners.delete(onWait))
  }

  private currentFactories(): string[] {
    return (this.factoryContexts.getStore() ?? []).map((context) => context.mockId)
  }

  private waitsForFactories(id: string, factories = this.currentFactories()): boolean {
    const queue = [...factories]
    const visited = new Set(factories)
    // a factory that waits for the current one makes everything that waits for it wait too
    while (queue.length) {
      const waiting = this.pendingFactories.get(queue.pop()!)?.waiting
      if (waiting?.has(id)) {
        return true
      }
      waiting?.forEach((waiter) => {
        if (this.pendingFactories.has(waiter) && !visited.has(waiter)) {
          visited.add(waiter)
          queue.push(waiter)
        }
      })
    }
    return false
  }

  private ensureModule(id: string, url: string) {
    const node = this.evaluatedModules.ensureModule(id, url)
    // TODO
    node.meta = { id, url, code: '', file: null, invalidate: false }
    return node
  }

  private callFunctionMock(
    id: string,
    url: string,
    mock: ManualMockedModule,
    callstack: string[],
  ): Promise<any> {
    const node = this.ensureModule(id, url)
    if (node.exports) {
      return Promise.resolve(node.exports)
    }
    return this.resolveMockOnce(id, callstack, () => this.resolveFunctionMock(node, mock))
  }

  private resolveMockOnce(
    id: string,
    callstack: string[],
    resolve: () => Promise<any>,
  ): Promise<any> {
    const contexts = this.factoryContexts.getStore() ?? []
    const waiting = [...callstack, ...contexts.map((context) => context.mockId)]
    const pending = this.pendingFactories.get(id)
    if (pending) {
      waiting.forEach((waiter) => pending.waiting.add(waiter))
      this.waitListeners.forEach((onWait) => onWait())
      return pending.promise
    }
    const factory: PendingFactory = {
      promise: this.factoryContexts
        .run([...contexts, { mockId: id, callstack }], resolve)
        .finally(() => {
          if (this.pendingFactories.get(id) === factory) {
            this.pendingFactories.delete(id)
          }
          if (!this.pendingFactories.size) {
            // an enabled storage slows down every promise on Node 22
            this.factoryContexts.disable()
          }
        }),
      waiting: new Set(waiting),
    }
    this.pendingFactories.set(id, factory)
    return factory.promise
  }

  private async resolveAutomock(
    url: string,
    mockId: string,
    evaluatedNode: EvaluatedModuleNode,
    callstack: string[],
    type: 'automock' | 'autospy',
  ) {
    const Object = this.primitives.Object
    // we have to define a separate object that will copy all properties into itself
    // and can't just use the same `exports` define automatically by Vite before the evaluator
    const exports = Object.create(null)
    Object.defineProperty(exports, Symbol.toStringTag, {
      value: 'Module',
      configurable: true,
      writable: true,
    })
    const node = this.ensureModule(mockId, this.getMockPath(evaluatedNode.url))
    node.meta = evaluatedNode.meta
    node.file = evaluatedNode.file
    node.mockedExports = exports

    const mod = await this.moduleRunner.cachedRequest(url, node, callstack, undefined, true)
    this.mockObject(mod, exports, type)
    return exports
  }

  private async resolveFunctionMock(node: EvaluatedModuleNode, mock: ManualMockedModule) {
    const exports = await mock.resolve()

    const moduleExports = new Proxy(exports, {
      get: (target, prop) => {
        const val = target[prop]

        // 'then' can exist on non-Promise objects, need nested instanceof check for logic to work
        if (prop === 'then') {
          if (target instanceof Promise) {
            return target.then.bind(target)
          }
        } else if (!(prop in target)) {
          if (this.filterPublicKeys.includes(prop)) {
            return undefined
          }
          throw this.createError(
            `[vitest] No "${String(prop)}" export is defined on the "${mock.raw}" mock. ` +
              'Did you forget to return it from "vi.mock"?' +
              '\nIf you need to partially mock a module, you can use "importOriginal" helper inside:\n',
            `vi.mock(import("${mock.raw}"), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // your mocked methods
  }
})`,
          )
        }

        return val
      },
    })

    node.exports = moduleExports

    return moduleExports
  }

  public async importActual<T>(
    rawId: string,
    importer: string,
    callstack?: string[] | null,
  ): Promise<T> {
    const { url } = await this.resolveId(rawId, importer)
    const actualUrl = injectQuery(url, '_vitest_original')
    const node = await this.moduleRunner.fetchModule(actualUrl, importer)
    const result = await this.moduleRunner.cachedRequest(
      node.url,
      node,
      callstack || [importer],
      undefined,
      true,
    )
    return result as T
  }

  public async importMock(rawId: string, importer: string): Promise<any> {
    const { id, url, external } = await this.resolveId(rawId, importer)

    let mock = this.getDependencyMock(id)

    if (!mock) {
      const redirect = this.findMockRedirect(id, external, rawId)
      if (redirect) {
        mock = new RedirectedModule(rawId, id, rawId, redirect)
      } else {
        mock = new AutomockedModule(rawId, id, rawId)
      }
    }

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const node = await this.moduleRunner.fetchModule(url, importer)
      const mod = await this.moduleRunner.cachedRequest(url, node, [importer], undefined, true)
      const Object = this.primitives.Object
      return this.mockObject(mod, Object.create(Object.prototype), mock.type)
    }

    if (mock.type === 'manual') {
      const mockId = this.getMockPath(id)
      return this.callFunctionMock(mockId, this.getMockPath(url), mock, [importer, mockId])
    }
    const node = await this.moduleRunner.fetchModule(mock.redirect)
    return this.moduleRunner.cachedRequest(mock.redirect, node, [importer], undefined, true)
  }

  public async requestWithMockedModule(
    url: string,
    evaluatedNode: EvaluatedModuleNode,
    callstack: string[],
    mock: MockedModule,
  ): Promise<any> {
    return this._otel.$('vitest.mocker.evaluate', async (span) => {
      const mockId = this.getMockPath(evaluatedNode.id)

      span.setAttributes({
        'vitest.module.id': mockId,
        'vitest.mock.type': mock.type,
        'vitest.mock.id': mock.id,
        'vitest.mock.url': mock.url,
        'vitest.mock.raw': mock.raw,
      })

      if (mock.type === 'automock' || mock.type === 'autospy') {
        const cache = this.evaluatedModules.getModuleById(mockId)
        if (cache?.mockedExports) {
          // while the original module evaluates, only its own imports get the partial object, like in a cycle
          const isSelfImport = callstack.includes(evaluatedNode.id) || this.isResolvingMock(mockId)
          if (!this.pendingFactories.has(mockId) || isSelfImport) {
            return cache.mockedExports
          }
        }
        return this.resolveMockOnce(mockId, [...callstack, mockId], () =>
          this.resolveAutomock(url, mockId, evaluatedNode, callstack, mock.type),
        )
      }
      if (
        mock.type === 'manual' &&
        !callstack.includes(mockId) &&
        !callstack.includes(url) &&
        !this.isResolvingMock(mockId)
      ) {
        return this.callFunctionMock(mockId, this.getMockPath(url), mock, [...callstack, mockId])
      } else if (mock.type === 'redirect' && !callstack.includes(mock.redirect)) {
        span.setAttribute('vitest.mock.redirect', mock.redirect)
        return mock.redirect
      }
    })
  }

  public async mockedRequest(
    url: string,
    evaluatedNode: EvaluatedModuleNode,
    callstack: string[],
  ): Promise<any> {
    const mock = this.getDependencyMock(evaluatedNode.id)

    if (!mock) {
      return
    }

    return this.requestWithMockedModule(url, evaluatedNode, callstack, mock)
  }
}

declare module 'vite/module-runner' {
  interface EvaluatedModuleNode {
    /**
     * @internal
     */
    mockedExports?: Record<string, any>
  }
}
