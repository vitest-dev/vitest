type Promisable<T> = T | Promise<T>

export type MockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M = M>() => Promise<T>
) => Promisable<Record<keyof M, any> | null>
export type MockFactory = () => any

export type MockMap = Map<string, Record<string, string | null | MockFactory>>

export interface PendingSuiteMock {
  id: string
  importer: string
  type: 'mock' | 'unmock'
  throwIfCached: boolean
  factory?: MockFactory
}
