import type {
  Custom as Custom_,
  DoneCallback as DoneCallback_,
  File as File_,
  Suite as Suite_,
  Task as Task_,
  TaskBase as TaskBase_,
  TaskResult as TaskResult_,
  TaskResultPack as TaskResultPack_,
  Test as Test_,
} from '@vitest/runner'
import type {
  /** @deprecated import from `vitest/node` instead */
  Vitest as Vitest_,
} from '../node/core'

import type {
  BenchmarkUserOptions as BenchmarkUserOptions_,
} from '../node/types/benchmark'
import type {
  ApiConfig as ApiConfig_,
  BrowserConfigOptions as BrowserConfigOptions_,
  BrowserScript as BrowserScript_,
  BuiltinEnvironment as BuiltinEnvironment_,
  CSSModuleScopeStrategy as CSSModuleScopeStrategy_,
  DepsOptimizationOptions as DepsOptimizationOptions_,
  EnvironmentOptions as EnvironmentOptions_,
  HappyDOMOptions as HappyDOMOptions_,
  InlineConfig as InlineConfig_,
  JSDOMOptions as JSDOMOptions_,
  Pool as Pool_,
  PoolOptions as PoolOptions_,
  ProjectConfig as ProjectConfig_,
  ResolvedConfig as ResolvedConfig_,
  SequenceHooks as SequenceHooks_,
  SequenceSetupFiles as SequenceSetupFiles_,
  TransformModePatterns as TransformModePatterns_,
  TypecheckConfig as TypecheckConfig_,
  UserConfig as UserConfig_,
  UserWorkspaceConfig as UserWorkspaceConfig_,
  VitestEnvironment as VitestEnvironment_,
  VitestRunMode as VitestRunMode_,
} from '../node/types/config'

import type {
  /** @deprecated import from `vitest/node` instead */
  Reporter as Reporter_,
} from '../node/types/reporter'

import type {
  WorkerContext as WorkerContext_,
} from '../node/types/worker'

import type { SerializedTestSpecification } from '../runtime/types/utils'

import type {
  CollectLineNumbers as CollectLineNumbers_,
  CollectLines as CollectLines_,
  Context as Context_,
  RawErrsMap as RawErrsMap_,
  RootAndTarget as RootAndTarget_,
  TscErrorInfo as TscErrorInfo_,
} from '../typecheck/types'
import type {
  WorkerRPC as WorkerRPC_,
} from '../types/worker'

// TODO: deprecate <reference types="vitest" /> in favor of `<reference types="vitest/config" />`
import '../node/types/vite'
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

/** @deprecated import `TypeCheckRawErrorsMap` from `vitest/node` instead */
export type RawErrsMap = RawErrsMap_
/** @deprecated import `TypeCheckErrorInfo` from `vitest/node` instead */
export type TscErrorInfo = TscErrorInfo_
/** @deprecated import `TypeCheckCollectLineNumbers` from `vitest/node` instead */
export type CollectLineNumbers = CollectLineNumbers_
/** @deprecated import `TypeCheckCollectLines` from `vitest/node` instead */
export type CollectLines = CollectLines_
/** @deprecated import `TypeCheckRootAndTarget` from `vitest/node` instead */
export type RootAndTarget = RootAndTarget_
/** @deprecated import `TypeCheckContext` from `vitest/node` instead */
export type Context = Context_

/** @deprecated use `RunnerTestSuite` instead */
export type Suite = Suite_
/** @deprecated use `RunnerTestFile` instead */
export type File = File_
/** @deprecated use `RunnerTestCase` instead */
export type Test = Test_
/** @deprecated do not use `Custom`, use `RunnerTestCase` instead */
export type Custom = Custom_
/** @deprecated use `RunnerTask` instead */
export type Task = Task_
/** @deprecated use `RunnerTaskBase` instead */
export type TaskBase = TaskBase_
/** @deprecated use `RunnerTaskResult` instead */
export type TaskResult = TaskResult_
/** @deprecated use `RunnerTaskResultPack` instead */
export type TaskResultPack = TaskResultPack_

/** @deprecated don't use `DoneCallback` since it's not supported */
export type DoneCallback = DoneCallback_

export type { AssertType } from '../typecheck/assertType'
export { expectTypeOf } from '../typecheck/expectTypeOf'
export type { ExpectTypeOf } from '../typecheck/expectTypeOf'

/** @deprecated import from `vitest/node` instead */
export type WorkerContext = WorkerContext_
/** @deprecated import from `vitest/node` instead */
export type WorkerRPC = WorkerRPC_

export type { BrowserTesterOptions } from '../types/browser'
export type {
  AfterSuiteRunMeta,
  LabelColor,
  ModuleCache,
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
  ResolveIdFunction,
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
  ExtendedContext,
  HookCleanupCallback,
  HookListener,
  ImportDuration,
  OnTestFailedHandler,
  OnTestFinishedHandler,
  RunMode,
  Custom as RunnerCustomCase,
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
  TaskContext,
  TaskCustomOptions,
  TaskMeta,
  TaskState,
  TestAnnotation,
  TestAPI,
  TestContext,
  TestFunction,
  TestOptions,
} from '@vitest/runner'

/** @deprecated import from `vitest/reporter` instead */
export type Reporter = Reporter_
/** @deprecated import from `vitest/node` instead */
export type Vitest = Vitest_

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

/** @deprecated import from `vitest/node` instead */
export type BrowserScript = BrowserScript_
/** @deprecated import from `vitest/node` instead */
export type BrowserConfigOptions = BrowserConfigOptions_
/** @deprecated import from `vitest/node` instead */
export type SequenceHooks = SequenceHooks_
/** @deprecated import from `vitest/node` instead */
export type SequenceSetupFiles = SequenceSetupFiles_
/** @deprecated import from `vitest/node` instead */
export type BuiltinEnvironment = BuiltinEnvironment_
/** @deprecated import from `vitest/node` instead */
export type VitestEnvironment = VitestEnvironment_
/** @deprecated import from `vitest/node` instead */
export type Pool = Pool_
/** @deprecated import from `vitest/node` instead */
export type PoolOptions = PoolOptions_
/** @deprecated import from `vitest/node` instead */
export type CSSModuleScopeStrategy = CSSModuleScopeStrategy_
/** @deprecated import from `vitest/node` instead */
export type ApiConfig = ApiConfig_
/** @deprecated import from `vitest/node` instead */
export type JSDOMOptions = JSDOMOptions_
/** @deprecated import from `vitest/node` instead */
export type HappyDOMOptions = HappyDOMOptions_
/** @deprecated import from `vitest/node` instead */
export type EnvironmentOptions = EnvironmentOptions_
/** @deprecated import from `vitest/node` instead */
export type VitestRunMode = VitestRunMode_
/** @deprecated import from `vitest/node` instead */
export type DepsOptimizationOptions = DepsOptimizationOptions_
/** @deprecated import from `vitest/node` instead */
export type TransformModePatterns = TransformModePatterns_
/** @deprecated import from `vitest/node` instead */
export type InlineConfig = InlineConfig_
/** @deprecated import from `vitest/node` instead */
export type TypecheckConfig = TypecheckConfig_
/** @deprecated import from `vitest/node` instead */
export type UserConfig = UserConfig_
/** @deprecated import from `vitest/node` instead */
export type ResolvedConfig = ResolvedConfig_
/** @deprecated import from `vitest/node` instead */
export type ProjectConfig = ProjectConfig_
/** @deprecated import from `vitest/node` instead */
export type UserWorkspaceConfig = UserWorkspaceConfig_

export type { SerializedError } from '@vitest/utils'

/** @deprecated use `SerializedTestSpecification` instead */
export type SerializableSpec = SerializedTestSpecification
export type { SerializedTestSpecification }

/** @deprecated import from `vitest/node` instead */
export type BenchmarkUserOptions = BenchmarkUserOptions_

export type { DiffOptions } from '@vitest/utils/diff'
