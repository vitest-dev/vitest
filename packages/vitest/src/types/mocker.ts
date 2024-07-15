export type MockFactoryWithHelper<M = unknown> = (
  importOriginal: () => Promise<M>
) => Partial<Record<keyof M, any>>
export type PromiseMockFactoryWithHelper<M = unknown> = (
  importOriginal: () => Promise<M>
) => Promise<Partial<Record<keyof M, any>>>
export type MockFactory = () => any

export type MockMap = Map<string, Record<string, string | null | MockFactory>>

export interface PendingSuiteMock {
  id: string
  importer: string
  type: 'mock' | 'unmock'
  throwIfCached: boolean
  factory?: MockFactory
}
