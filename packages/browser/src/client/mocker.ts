import type { ResolvedConfig } from 'vitest'
import { buildFakeModule } from './fakeModule'

function throwNotImplemented(name: string) {
  throw new Error(`[vitest] ${name} is not implemented in browser environment yet.`)
}

export class VitestBrowserClientMocker {
  constructor(public config: ResolvedConfig) {}

  private wrappedImports = new WeakMap<any, any>()

  /**
   * Browser tests don't run in parallel. This clears all mocks after each run.
   */
  public resetAfterFile() {
    this.resetModules()
  }

  public resetModules() {
    this.wrappedImports = new WeakMap()
  }

  public async wrap(fn: () => Promise<any>) {
    if (!this.config.browser.proxyHijackESM)
      throw new Error(`hijackESM disabled but mocker invoked`)

    const module = await fn()

    let wrapped = this.wrappedImports.get(module)
    if (wrapped === undefined) {
      wrapped = buildFakeModule(module)
      this.wrappedImports.set(module, wrapped)
    }
    return wrapped
  }

  public importActual() {
    throwNotImplemented('importActual')
  }

  public importMock() {
    throwNotImplemented('importMock')
  }

  public queueMock() {
    throwNotImplemented('queueMock')
  }

  public queueUnmock() {
    throwNotImplemented('queueUnmock')
  }

  public prepare() {
    // TODO: prepare
  }
}
