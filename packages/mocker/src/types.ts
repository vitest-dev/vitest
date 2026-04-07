/* eslint-disable ts/method-signature-style */

type Awaitable<T> = T | PromiseLike<T>

export type ModuleMockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M = M>() => Promise<T>,
) => Awaitable<Partial<M>>
export type ModuleMockFactory = () => any
export interface ModuleMockOptions {
  spy?: boolean
}

export interface ServerMockResolution {
  mockType: 'manual' | 'redirect' | 'automock' | 'autospy'
  resolvedId: string
  resolvedUrl: string
  needsInterop?: boolean
  redirectUrl?: string | null
}

export interface ServerIdResolution {
  id: string
  url: string
  optimized: boolean
}

export interface ModuleMockContext {
  /**
   * When mocking with a factory, this refers to the module that imported the mock.
   */
  callstack: null | string[]
}

export interface TestModuleMocker {
  queueMock(
    id: string,
    importer: string,
    factoryOrOptions?: ModuleMockFactory | ModuleMockOptions,
  ): void
  queueUnmock(id: string, importer: string): void
  importActual<T>(
    rawId: string,
    importer: string,
    callstack?: string[] | null,
  ): Promise<T>
  importMock(rawId: string, importer: string): Promise<any>
  mockObject(
    object: Record<string | symbol, any>,
    moduleType?: 'automock' | 'autospy',
  ): Record<string | symbol, any>
  mockObject(
    object: Record<string | symbol, any>,
    mockExports: Record<string | symbol, any> | undefined,
    moduleType?: 'automock' | 'autospy',
  ): Record<string | symbol, any>
  getMockContext(): ModuleMockContext
  reset(): void
}
