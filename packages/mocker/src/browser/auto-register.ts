import { ModuleMockerServerInterceptor } from './interceptor-native'
import { registerModuleMocker } from './register'

registerModuleMocker(
  () => new ModuleMockerServerInterceptor(),
)
