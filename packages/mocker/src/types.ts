type Awaitable<T> = T | PromiseLike<T>

export type ModuleMockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M = M>() => Promise<T>
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
