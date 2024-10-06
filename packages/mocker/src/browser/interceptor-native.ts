import type { MockedModule } from '../registry'
import type { ModuleMockerInterceptor } from './interceptor'
import { rpc } from './utils'

export class ModuleMockerServerInterceptor implements ModuleMockerInterceptor {
  async register(module: MockedModule): Promise<void> {
    await rpc('vitest:interceptor:register', module.toJSON())
  }

  async delete(id: string): Promise<void> {
    await rpc('vitest:interceptor:delete', id)
  }

  invalidate(): void {
    rpc('vitest:interceptor:invalidate')
  }
}
