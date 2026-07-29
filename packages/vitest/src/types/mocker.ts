import type { MockedModuleType, ModuleMockFactory } from '@vitest/mocker'

export type {
  ModuleMockFactory as MockFactory,
  ModuleMockFactoryWithHelper as MockFactoryWithHelper,
  ModuleMockOptions as MockOptions,
} from '@vitest/mocker'

export interface PendingSuiteMock {
  id: string
  importer: string
  action: 'mock' | 'unmock'
  type?: MockedModuleType
  factory?: ModuleMockFactory
}
