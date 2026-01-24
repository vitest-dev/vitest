import type { ManualMockedModule, MockedModule } from '@vitest/mocker'
import type { EvaluatedModuleNode } from 'vite/module-runner'
import type { BareModuleMockerOptions } from './bareModuleMocker'
import type { VitestModuleRunner } from './moduleRunner'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { AutomockedModule, RedirectedModule } from '@vitest/mocker'
import { distDir } from '../../paths'
import { BareModuleMocker } from './bareModuleMocker'

const spyModulePath = resolve(distDir, 'spy.js')

export interface VitestMockerOptions extends BareModuleMockerOptions {
  context?: vm.Context
}

export class VitestMocker extends BareModuleMocker {
  private filterPublicKeys: (symbol | string)[]

  constructor(public moduleRunner: VitestModuleRunner, protected options: VitestMockerOptions) {
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

  public reset(): void {
    this.registries.clear()
  }

  protected invalidateModuleById(id: string): void {
    const mockId = this.getMockPath(id)
    const node = this.evaluatedModules.getModuleById(mockId)
    if (node) {
      this.evaluatedModules.invalidateModule(node)
      node.mockedExports = undefined
    }
  }

  private ensureModule(id: string, url: string) {
    const node = this.evaluatedModules.ensureModule(id, url)
    // TODO
    node.meta = { id, url, code: '', file: null, invalidate: false }
    return node
  }

  private async callFunctionMock(id: string, url: string, mock: ManualMockedModule) {
    const node = this.ensureModule(id, url)
    if (node.exports) {
      return node.exports
    }
    const exports = await mock.resolve()

    const moduleExports = new Proxy(exports, {
      get: (target, prop) => {
        const val = target[prop]

        // 'then' can exist on non-Promise objects, need nested instanceof check for logic to work
        if (prop === 'then') {
          if (target instanceof Promise) {
            return target.then.bind(target)
          }
        }
        else if (!(prop in target)) {
          if (this.filterPublicKeys.includes(prop)) {
            return undefined
          }
          throw this.createError(
            `[vitest] No "${String(prop)}" export is defined on the "${mock.raw}" mock. `
            + 'Did you forget to return it from "vi.mock"?'
            + '\nIf you need to partially mock a module, you can use "importOriginal" helper inside:\n',
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
    const node = await this.moduleRunner.fetchModule(url, importer)
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
      const redirect = this.findMockRedirect(id, external)
      if (redirect) {
        mock = new RedirectedModule(rawId, id, rawId, redirect)
      }
      else {
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
      return this.callFunctionMock(id, url, mock)
    }
    const node = await this.moduleRunner.fetchModule(mock.redirect)
    return this.moduleRunner.cachedRequest(
      mock.redirect,
      node,
      [importer],
      undefined,
      true,
    )
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
        if (cache && cache.mockedExports) {
          return cache.mockedExports
        }
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

        const mod = await this.moduleRunner.cachedRequest(
          url,
          node,
          callstack,
          undefined,
          true,
        )
        this.mockObject(mod, exports, mock.type)
        return exports
      }
      if (
        mock.type === 'manual'
        && !callstack.includes(mockId)
        && !callstack.includes(url)
      ) {
        try {
          callstack.push(mockId)
          // this will not work if user does Promise.all(import(), import())
          // we can also use AsyncLocalStorage to store callstack, but this won't work in the browser
          // maybe we should improve mock API in the future?
          this.mockContext.callstack = callstack
          return await this.callFunctionMock(mockId, this.getMockPath(url), mock)
        }
        finally {
          this.mockContext.callstack = null
          const indexMock = callstack.indexOf(mockId)
          callstack.splice(indexMock, 1)
        }
      }
      else if (mock.type === 'redirect' && !callstack.includes(mock.redirect)) {
        span.setAttribute('vitest.mock.redirect', mock.redirect)
        return mock.redirect
      }
    })
  }

  public async mockedRequest(url: string, evaluatedNode: EvaluatedModuleNode, callstack: string[]): Promise<any> {
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
