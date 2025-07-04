import type { SerializedTestSpecification } from '../runtime/types/utils'

import '../types/global'

export type {
  TransformResultWithSource,
  WebSocketEvents,
  WebSocketHandlers,
  WebSocketRPC,
} from '../api/types'
export { assert, chai, createExpect, expect, should } from '../integrations/chai'
export { inject } from '../integrations/inject'

export { vi, vitest } from '../integrations/vi'
export type { VitestUtils } from '../integrations/vi'
export { bench } from '../runtime/benchmark'

export type {
  RuntimeConfig,
  SerializedConfig,
  SerializedCoverageConfig,
} from '../runtime/config'

export type {
  BenchFactory,
  BenchFunction,
  Benchmark,
  BenchmarkAPI,
  BenchmarkResult,
  BenchOptions,
  BenchTask,
  BenchTaskResult,
} from '../runtime/types/benchmark'
export { assertType } from '../typecheck/assertType'

export type { AssertType } from '../typecheck/assertType'
export { expectTypeOf } from '../typecheck/expectTypeOf'
export type { ExpectTypeOf } from '../typecheck/expectTypeOf'

export type { BrowserTesterOptions } from '../types/browser'
export type {
  AfterSuiteRunMeta,
  LabelColor,
  ModuleGraphData,
  ParsedStack,
  ProvidedContext,
  TestError,
  UserConsoleLog,
} from '../types/general'

export type {
  RunnerRPC,
  RuntimeRPC,
} from '../types/rpc'

export type { BrowserUI } from '../types/ui'

export type {
  ContextRPC,
  ContextTestEnvironment,
  TestExecutionMethod,
  WorkerGlobalState,
} from '../types/worker'
export type {
  Assertion,
  AsymmetricMatchersContaining,
  DeeplyAllowMatchers,
  ExpectPollOptions,
  ExpectStatic,
  JestAssertion,
  Matchers,
} from '@vitest/expect'
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  onTestFailed,
  onTestFinished,
  suite,
  test,
} from '@vitest/runner'
export type {
  HookCleanupCallback,
  HookListener,
  ImportDuration,
  OnTestFailedHandler,
  OnTestFinishedHandler,
  RunMode,
  Task as RunnerTask,
  TaskBase as RunnerTaskBase,
  TaskEventPack as RunnerTaskEventPack,
  TaskResult as RunnerTaskResult,
  TaskResultPack as RunnerTaskResultPack,
  Test as RunnerTestCase,
  File as RunnerTestFile,
  Suite as RunnerTestSuite,
  SuiteAPI,
  SuiteCollector,
  SuiteFactory,
  TaskCustomOptions,
  TaskMeta,
  TaskState,
  TestAnnotation,
  TestAPI,
  TestContext,
  TestFunction,
  TestOptions,
} from '@vitest/runner'

export type { CancelReason } from '@vitest/runner'

export type {
  SnapshotData,
  SnapshotMatchOptions,
  SnapshotResult,
  SnapshotSerializer,
  SnapshotStateOptions,
  SnapshotSummary,
  SnapshotUpdateState,
  UncheckedSnapshot,
} from '@vitest/snapshot'

export type {
  Mock,
  MockContext,
  Mocked,
  MockedClass,
  MockedFunction,
  MockedObject,
  MockInstance,
} from '@vitest/spy'

export type { SerializedError } from '@vitest/utils'
export type { SerializedTestSpecification }
export type { DiffOptions } from '@vitest/utils/diff'
