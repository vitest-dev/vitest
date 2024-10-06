import type { MockedModule } from '../registry'

export interface ModuleMockerInterceptor {
  register: (module: MockedModule) => Promise<void>
  delete: (url: string) => Promise<void>
  invalidate: () => void
}
