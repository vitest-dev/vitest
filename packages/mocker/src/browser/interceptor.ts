import type { MockedModule } from '../registry'

export interface ModuleMockerInterceptor {
  register: (module: MockedModule, importer: string) => Promise<void>
  delete: (url: string) => Promise<void>
  invalidate: () => Promise<void>
}
