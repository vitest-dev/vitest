import type { MaybeMockedDeep } from '@vitest/spy'
import type { ModuleMockFactoryWithHelper, ModuleMockOptions } from '../types'
import type { ModuleMocker } from './mocker'
import { createSimpleStackTrace } from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'

export interface CompilerHintsOptions {
  /**
   * This is the key used to access the globalThis object in the worker.
   * Unlike `globalThisAccessor` in other APIs, this is not injected into the script.
   * ```ts
   * // globalThisKey: '__my_variable__' produces:
   * globalThis['__my_variable__']
   * // globalThisKey: '"__my_variable__"' produces:
   * globalThis['"__my_variable__"'] // notice double quotes
   * ```
   * @default '__vitest_mocker__'
   */
  globalThisKey?: string
}

export interface ModuleMockerCompilerHints {
  hoisted: <T>(factory: () => T) => T
  mock: (path: string | Promise<unknown>, factory?: ModuleMockOptions | ModuleMockFactoryWithHelper) => void
  unmock: (path: string | Promise<unknown>) => void
  doMock: (path: string | Promise<unknown>, factory?: ModuleMockOptions | ModuleMockFactoryWithHelper) => void
  doUnmock: (path: string | Promise<unknown>) => void
  importActual: <T>(path: string) => Promise<T>
  importMock: <T>(path: string) => Promise<MaybeMockedDeep<T>>
}

export function createCompilerHints(options?: CompilerHintsOptions): ModuleMockerCompilerHints {
  const globalThisAccessor = options?.globalThisKey || '__vitest_mocker__'
  function _mocker(): ModuleMocker {
    // @ts-expect-error injected by the plugin
    return typeof globalThis[globalThisAccessor] !== 'undefined'
      // @ts-expect-error injected by the plugin
      ? globalThis[globalThisAccessor]
      : new Proxy(
        {},
        {
          get(_, name) {
            throw new Error(
              'Vitest mocker was not initialized in this environment. '
              + `vi.${String(name)}() is forbidden.`,
            )
          },
        },
      )
  }

  return {
    hoisted<T>(factory: () => T): T {
      if (typeof factory !== 'function') {
        throw new TypeError(
          `vi.hoisted() expects a function, but received a ${typeof factory}`,
        )
      }
      return factory()
    },

    mock(path: string | Promise<unknown>, factory?: ModuleMockOptions | ModuleMockFactoryWithHelper): void {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.mock() expects a string path, but received a ${typeof path}`,
        )
      }
      const importer = getImporter('mock')
      _mocker().queueMock(
        path,
        importer,
        typeof factory === 'function'
          ? () =>
              factory(() =>
                _mocker().importActual(
                  path,
                  importer,
                ),
              )
          : factory,
      )
    },

    unmock(path: string | Promise<unknown>): void {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.unmock() expects a string path, but received a ${typeof path}`,
        )
      }
      _mocker().queueUnmock(path, getImporter('unmock'))
    },

    doMock(path: string | Promise<unknown>, factory?: ModuleMockOptions | ModuleMockFactoryWithHelper): void {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.doMock() expects a string path, but received a ${typeof path}`,
        )
      }
      const importer = getImporter('doMock')
      _mocker().queueMock(
        path,
        importer,
        typeof factory === 'function'
          ? () =>
              factory(() =>
                _mocker().importActual(
                  path,
                  importer,
                ),
              )
          : factory,
      )
    },

    doUnmock(path: string | Promise<unknown>): void {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.doUnmock() expects a string path, but received a ${typeof path}`,
        )
      }
      _mocker().queueUnmock(path, getImporter('doUnmock'))
    },

    async importActual<T = unknown>(path: string): Promise<T> {
      return _mocker().importActual<T>(
        path,
        getImporter('importActual'),
      )
    },

    async importMock<T>(path: string): Promise<MaybeMockedDeep<T>> {
      return _mocker().importMock(path, getImporter('importMock'))
    },
  }
}

function getImporter(name: string) {
  const stackTrace = /* @__PURE__ */ createSimpleStackTrace({ stackTraceLimit: 5 })
  const stackArray = stackTrace.split('\n')
  // if there is no message in a stack trace, use the item - 1
  const importerStackIndex = stackArray.findIndex((stack) => {
    return stack.includes(` at Object.${name}`) || stack.includes(`${name}@`)
  })
  const stack = /* @__PURE__ */ parseSingleStack(stackArray[importerStackIndex + 1])
  return stack?.file || ''
}
