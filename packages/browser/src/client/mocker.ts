import type { ResolvedConfig } from 'vitest'
import { buildFakeModule } from './fakeModule'

function throwNotImplemented(name: string) {
  throw new Error(`[vitest] ${name} is not implemented in browser environment yet.`)
}

async function fixEsmExport<T extends Record<string | symbol, any>>(contentsPromise: Promise<T>): Promise<T> {
  const contents = await contentsPromise

  if (!('default' in contents))
    return contents

  if (contents.default.__esModule)
    return contents.default

  for (const key in contents) {
    if (key !== 'default')
      return contents
  }

  if (!['object', 'function'].includes(typeof contents.default))
    return contents

  // vitest/vite doesn't import React (possibly others) via CJS correctly when imports are rewritten
  // where there's only a 'default' property, expand its properties to the top-level
  return {
    ...contents.default,
    default: contents.default,
  }
}

export class VitestBrowserClientMocker {
  constructor(public config: ResolvedConfig) {}

  private cachedImports = new Map<string, Promise<any>>()

  /**
   * Browser tests don't run in parallel. This clears all mocks after each run.
   */
  public resetAfterFile() {
    this.resetModules()
  }

  public resetModules() {
    this.cachedImports.clear()
  }

  public async import(resolved: string, _id: string, _importee: string) {
    if (!this.config.browser.proxyHijackESM)
      throw new Error(`hijackESM disabled but mocker invoked`)

    const prev = this.cachedImports.get(resolved)
    if (prev !== undefined)
      return prev

    const task = (async () => {
      const contents = await fixEsmExport(import(resolved))
      return buildFakeModule(contents)
    })()
    this.cachedImports.set(resolved, task)
    return task
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
