import type { TestModuleMocker } from '@vitest/mocker'
import type { ModuleExecutionInfo } from './moduleDebug'

export interface TestModuleRunner {
  moduleExecutionInfo?: ModuleExecutionInfo
  mocker?: TestModuleMocker
  import: <T = any>(moduleId: string) => Promise<T>
}
