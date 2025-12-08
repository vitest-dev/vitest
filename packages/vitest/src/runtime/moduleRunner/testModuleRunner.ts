import type { ModuleExecutionInfo } from './moduleDebug'
import type { VitestMocker } from './moduleMocker'

export interface TestModuleRunner {
  moduleExecutionInfo?: ModuleExecutionInfo
  mocker?: VitestMocker
  import: <T = any>(moduleId: string) => Promise<T>
}
