import { ModuleMockerMSWInterceptor } from './msw'
import { registerModuleMocker } from './register'

registerModuleMocker(
  globalThisAccessor => new ModuleMockerMSWInterceptor({
    globalThisAccessor,
  }),
)
