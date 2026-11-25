import type { MockedModule } from '../registry'

export interface ModuleMockerInterceptor {
  register: (module: MockedModule, importer: string) => Promise<void>
  delete: (url: string) => Promise<void>
  invalidate: () => Promise<void>
  /**
   * The URL that loads a registered mock, if it is not the URL of the module.
   */
  getMockUrl?: (url: string) => string | undefined
}
