import './vite'
import './global'

export { expectTypeOf, type ExpectTypeOf } from '../typecheck/expectTypeOf'
export { assertType, type AssertType } from '../typecheck/assertType'
export type * from '../typecheck/types'
export type * from './config'
export type * from './tasks'
export type * from './rpc'
export type * from './reporter'
export type * from './snapshot'
export type * from './worker'
export type * from './general'
export type * from './coverage'
export type * from './benchmark'
export type { DiffOptions } from '@vitest/utils/diff'
export type {
  MockedFunction,
  MockedObject,
  SpyInstance,
  MockInstance,
  Mock,
  MockContext,
  Mocked,
  MockedClass,
} from '../integrations/spy'

export type {
  ExpectStatic,
  AsymmetricMatchersContaining,
  JestAssertion,
  Assertion,
} from '@vitest/expect'
