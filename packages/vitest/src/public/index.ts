import type {
  Custom as Custom_,
  DoneCallback as DoneCallback_,
  File as File_,
  RuntimeContext as RuntimeContext_,
  Suite as Suite_,
  SuiteHooks as SuiteHooks_,
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
  BaseCoverageOptions as BaseCoverageOptions_,
  CoverageIstanbulOptions as CoverageIstanbulOptions_,
  CoverageOptions as CoverageOptions_,
  CoverageProvider as CoverageProvider_,
  CoverageProviderModule as CoverageProviderModule_,
  CoverageProviderName,
  CoverageReporter as CoverageReporter_,
  CoverageV8Options as CoverageV8Options_,
  CustomProviderOptions as CustomProviderOptions_,
  ReportContext as ReportContext_,
  ResolvedCoverageOptions as ResolvedCoverageOptions_,
} from '../node/types/coverage'

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
  Environment as Environment_,
  EnvironmentReturn as EnvironmentReturn_,
  ResolvedTestEnvironment as ResolvedTestEnvironment_,
  VmEnvironmentReturn as VmEnvironmentReturn_,
} from '../types/environment'
import type {
  ArgumentsType as ArgumentsType_,
  Arrayable as Arrayable_,
  Awaitable as Awaitable_,
  Constructable as Constructable_,
  MutableArray as MutableArray_,
  Nullable as Nullable_,
} from '../types/general'
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
export { isFirstRun, runOnce } from '../integrations/run-once'

export type {
  Mock,
  MockContext,
  Mocked,
  MockedClass,
  MockedFunction,
  MockedObject,
  MockInstance,
} from '../integrations/spy'
export { getRunningMode, isWatchMode } from '../integrations/utils'
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

/** @deprecated internal type, don't use it */
export type RuntimeContext = RuntimeContext_
/** @deprecated internal type, don't use it */
export type SuiteHooks = SuiteHooks_

export type { AssertType } from '../typecheck/assertType'
export { expectTypeOf } from '../typecheck/expectTypeOf'
export type { ExpectTypeOf } from '../typecheck/expectTypeOf'

/** @deprecated import from `vitest/node` instead */
export type WorkerContext = WorkerContext_
/** @deprecated import from `vitest/node` instead */
export type WorkerRPC = WorkerRPC_

export type {
  AfterSuiteRunMeta,
  ErrorWithDiff,
  ModuleCache,
  ModuleGraphData,
  ParsedStack,
  ProvidedContext,
  UserConsoleLog,
} from '../types/general'

/** @deprecated do not use, internal helper */
export type Awaitable<T> = Awaitable_<T>
/** @deprecated do not use, internal helper */
export type Nullable<T> = Nullable_<T>
/** @deprecated do not use, internal helper */
export type Arrayable<T> = Arrayable_<T>
/** @deprecated do not use, internal helper */
export type ArgumentsType<T> = ArgumentsType_<T>
/** @deprecated do not use, internal helper */
export type MutableArray<T extends readonly any[]> = MutableArray_<T>
/** @deprecated do not use, internal helper */
export type Constructable = Constructable_

export type {
  RunnerRPC,
  RuntimeRPC,
} from '../types/rpc'

export type { BrowserUI } from '../types/ui'

/** @deprecated import from `vitest/environments` instead */
export type EnvironmentReturn = EnvironmentReturn_
/** @deprecated import from `vitest/environments` instead */
export type VmEnvironmentReturn = VmEnvironmentReturn_
/** @deprecated import from `vitest/environments` instead */
export type Environment = Environment_
/** @deprecated do not use it */
export type ResolvedTestEnvironment = ResolvedTestEnvironment_

/** @deprecated import from `vitest/node` instead */
export type CoverageProvider = CoverageProvider_
/** @deprecated import from `vitest/node` instead */
export type ReportContext = ReportContext_
/** @deprecated import from `vitest/node` instead */
export type CoverageProviderModule = CoverageProviderModule_
/** @deprecated import from `vitest/node` instead */
export type CoverageReporter = CoverageReporter_
/** @deprecated import from `vitest/node` instead */
export type CoverageOptions<T extends CoverageProviderName = CoverageProviderName> = CoverageOptions_<T>
/** @deprecated import from `vitest/node` instead */
export type ResolvedCoverageOptions<T extends CoverageProviderName = CoverageProviderName> = ResolvedCoverageOptions_<T>
/** @deprecated import from `vitest/node` instead */
export type BaseCoverageOptions = BaseCoverageOptions_
/** @deprecated import from `vitest/node` instead */
export type CoverageIstanbulOptions = CoverageIstanbulOptions_
/** @deprecated import from `vitest/node` instead */
export type CoverageV8Options = CoverageV8Options_
/** @deprecated import from `vitest/node` instead */
export type CustomProviderOptions = CustomProviderOptions_

export type {
  ContextRPC,
  ContextTestEnvironment,
  ResolveIdFunction,
  WorkerGlobalState,
} from '../types/worker'
export type {
  Assertion,
  AsymmetricMatchersContaining,
  ExpectPollOptions,
  ExpectStatic,
  JestAssertion,
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
  OnTestFailedHandler,
  OnTestFinishedHandler,
  RunMode,
  Custom as RunnerCustomCase,
  Task as RunnerTask,
  TaskBase as RunnerTaskBase,
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

export type { SerializedError, TestError } from '@vitest/utils'

/** @deprecated use `SerializedTestSpecification` instead */
export type SerializableSpec = SerializedTestSpecification
export type { SerializedTestSpecification }

/** @deprecated import from `vitest/node` instead */
export type BenchmarkUserOptions = BenchmarkUserOptions_

export type { DiffOptions } from '@vitest/utils/diff'
