import type { MockedModuleType } from '@vitest/mocker'

type Promisable<T> = T | Promise<T>

export type MockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M = M>() => Promise<T>
) => Promisable<Partial<M>>
export type MockFactory = () => any
export interface MockOptions {
  spy?: boolean
}

export interface PendingSuiteMock {
  id: string
  importer: string
  action: 'mock' | 'unmock'
  type?: MockedModuleType
  factory?: MockFactory
}
