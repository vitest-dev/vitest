export {
  MockerRegistry,
  ManualMockedModule,
  RedirectedModule,
  AutomockedModule,
  AutospiedModule,
} from './registry'
export { mockObject } from './browser/automocker'

export type { GlobalConstructors } from './browser/automocker'
export type {
  MockedModule,
  MockedModuleType,
  MockedModuleSerialized,
  AutomockedModuleSerialized,
  AutospiedModuleSerialized,
  RedirectedModuleSerialized,
  ManualMockedModuleSerialized,
} from './registry'
