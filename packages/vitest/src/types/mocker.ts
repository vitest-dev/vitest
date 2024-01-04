export type MockFactoryWithHelper = (importOriginal: <T = unknown>() => Promise<T>) => any
export type MockFactory = () => any

export type MockMap = Map<string, Record<string, string | null | MockFactory>>

export interface PendingSuiteMock {
  id: string
  importer: string
  type: 'mock' | 'unmock'
  throwIfCached: boolean
  factory?: MockFactory
}
