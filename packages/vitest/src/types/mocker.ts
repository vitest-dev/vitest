export type MockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M>() => Promise<T>
) => any
export type MockFactory = () => any
export interface MockOptions {
  spy?: boolean
}

export type MockMap = Map<string, Record<string, string | null | MockFactory>>

export type MockBehaviour = 'autospy' | 'automock' | 'manual'

export interface PendingSuiteMock {
  id: string
  importer: string
  type: 'mock' | 'unmock'
  throwIfCached: boolean
  behaviour?: MockBehaviour
  factory?: MockFactory
}
