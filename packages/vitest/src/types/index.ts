import './vite'
import './global'

export { expectTypeOf, type ExpectTypeOf } from '../typecheck/expectTypeOf'
export { assertType, type AssertType } from '../typecheck/assertType'
export type * from '../typecheck/types'
export type * from './tasks'
export type * from './rpc'
export type * from './reporter'
export type * from './snapshot'
export type * from './worker'
export type * from './general'
export type * from './coverage'
export type * from './benchmark'
export type { CancelReason } from '@vitest/runner'
export type { DiffOptions } from '@vitest/utils/diff'
export type {
  MockedFunction,
  MockedObject,
  MockInstance,
  Mock,
  MockContext,
  Mocked,
  MockedClass,
} from '../integrations/spy'
export type { BrowserUI } from './ui'

export type {
  ExpectStatic,
  AsymmetricMatchersContaining,
  JestAssertion,
  Assertion,
  ExpectPollOptions,
} from '@vitest/expect'

export type {
  /** @deprecated import from `vitest/node` instead */
  BrowserScript,
  /** @deprecated import from `vitest/node` instead */
  BrowserConfigOptions,
  /** @deprecated import from `vitest/node` instead */
  SequenceHooks,
  /** @deprecated import from `vitest/node` instead */
  SequenceSetupFiles,
  /** @deprecated import from `vitest/node` instead */
  BuiltinEnvironment,
  /** @deprecated import from `vitest/node` instead */
  VitestEnvironment,
  /** @deprecated import from `vitest/node` instead */
  Pool,
  /** @deprecated import from `vitest/node` instead */
  PoolOptions,
  /** @deprecated import from `vitest/node` instead */
  CSSModuleScopeStrategy,
  /** @deprecated import from `vitest/node` instead */
  ApiConfig,
  /** @deprecated import from `vitest/node` instead */
  JSDOMOptions,
  /** @deprecated import from `vitest/node` instead */
  HappyDOMOptions,
  /** @deprecated import from `vitest/node` instead */
  EnvironmentOptions,
  /** @deprecated import from `vitest/node` instead */
  VitestRunMode,
  /** @deprecated import from `vitest/node` instead */
  DepsOptimizationOptions,
  /** @deprecated import from `vitest/node` instead */
  TransformModePatterns,
  /** @deprecated import from `vitest/node` instead */
  InlineConfig,
  /** @deprecated import from `vitest/node` instead */
  TypecheckConfig,
  /** @deprecated import from `vitest/node` instead */
  UserConfig,
  /** @deprecated import from `vitest/node` instead */
  ResolvedConfig,
  /** @deprecated import from `vitest/node` instead */
  ProjectConfig,
  /** @deprecated import from `vitest/node` instead */
  UserWorkspaceConfig,

  // deprecate all but this one
  RuntimeConfig,
} from './config'
