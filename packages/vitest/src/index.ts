// TODO: deprecate <reference types="vitest" /> in favor of `<reference types="vitest/config" />`
import './node/types/vite'
import './types/global'

export {
  suite,
  test,
  describe,
  it,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  onTestFailed,
  onTestFinished,
} from '@vitest/runner'
export { bench } from './runtime/benchmark'
export { expectTypeOf } from './typecheck/expectTypeOf'
export { assertType } from './typecheck/assertType'

export { runOnce, isFirstRun } from './integrations/run-once'
export { createExpect, assert, should, chai, expect } from './integrations/chai'
export { vi, vitest } from './integrations/vi'
export { getRunningMode, isWatchMode } from './integrations/utils'
export { inject } from './integrations/inject'

export type { VitestUtils } from './integrations/vi'

export type { ExpectTypeOf } from './typecheck/expectTypeOf'
export type { AssertType } from './typecheck/assertType'
export type {
  /** @deprecated import from `vitest/node` instead */
  RawErrsMap,
  /** @deprecated import from `vitest/node` instead */
  TscErrorInfo,
  /** @deprecated import from `vitest/node` instead */
  CollectLineNumbers,
  /** @deprecated import from `vitest/node` instead */
  CollectLines,
  /** @deprecated import from `vitest/node` instead */
  RootAndTarget,
  /** @deprecated import from `vitest/node` instead */
  Context,
} from './typecheck/types'

export type {
  RunMode,
  TaskState,
  TaskBase,
  TaskResult,
  TaskResultPack,
  Suite,
  File,
  Test,
  Task,
  DoneCallback,
  TestFunction,
  TestOptions,
  TestAPI,
  SuiteAPI,
  HookListener,
  HookCleanupCallback,
  SuiteHooks,
  SuiteCollector,
  SuiteFactory,
  RuntimeContext,
  TestContext,
  TaskContext,
  ExtendedContext,
  Custom,
  TaskCustomOptions,
  OnTestFailedHandler,
  TaskMeta,
} from '@vitest/runner'
export type {
  RuntimeRPC,
  RunnerRPC,
} from './types/rpc'
export type {
  SnapshotData,
  SnapshotUpdateState,
  SnapshotStateOptions,
  SnapshotMatchOptions,
  SnapshotResult,
  UncheckedSnapshot,
  SnapshotSummary,
  SnapshotSerializer,
} from '@vitest/snapshot'

export type {
  ResolveIdFunction,
  WorkerRPC,
  WorkerGlobalState,
  ContextTestEnvironment,
  ContextRPC,
} from './types/worker'
export type {
  /** @deprecated import from `vitest/node` instead */
  WorkerContext,
} from './node/types/worker'

export type {
  ErrorWithDiff,
  ParsedStack,
  /** @deprecated do not use, internal helper */
  Awaitable,
  /** @deprecated do not use, internal helper */
  Nullable,
  /** @deprecated do not use, internal helper */
  Arrayable,
  /** @deprecated do not use, internal helper */
  ArgumentsType,
  /** @deprecated do not use, internal helper */
  MutableArray,
  /** @deprecated do not use, internal helper */
  Constructable,
  ModuleCache,
  UserConsoleLog,
  ModuleGraphData,
  /** @deprecated import from `vitest/node` instead */
  OnServerRestartHandler,
  ProvidedContext,
  AfterSuiteRunMeta,
} from './types/general'
export type {
  /** @deprecated import from `vitest/environments` instead */
  EnvironmentReturn,
  /** @deprecated import from `vitest/environments` instead */
  VmEnvironmentReturn,
  /** @deprecated import from `vitest/environments` instead */
  Environment,
  /** @deprecated do not use it */
  ResolvedTestEnvironment,
} from './types/environment'
export type {
  /** @deprecated import from `vitest/node` instead */
  CoverageProvider,
  /** @deprecated import from `vitest/node` instead */
  ReportContext,
  /** @deprecated import from `vitest/node` instead */
  CoverageProviderModule,
  /** @deprecated import from `vitest/node` instead */
  CoverageReporter,
  /** @deprecated import from `vitest/node` instead */
  CoverageOptions,
  /** @deprecated import from `vitest/node` instead */
  ResolvedCoverageOptions,
  /** @deprecated import from `vitest/node` instead */
  BaseCoverageOptions,
  /** @deprecated import from `vitest/node` instead */
  CoverageIstanbulOptions,
  /** @deprecated import from `vitest/node` instead */
  CoverageV8Options,
  /** @deprecated import from `vitest/node` instead */
  CustomProviderOptions,
} from './node/types/coverage'

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
} from './integrations/spy'
export type { BrowserUI } from './types/ui'

export type {
  /** @deprecated import from `vitest/node` instead */
  Reporter,
} from './node/types/reporter'
export type {
  /** @deprecated import from `vitest/node` instead */
  Vitest,
} from './node/core'

export type {
  ExpectStatic,
  AsymmetricMatchersContaining,
  JestAssertion,
  Assertion,
  ExpectPollOptions,
} from '@vitest/expect'

export type {
  SerializedConfig,
  RuntimeConfig,
  SerializedCoverageConfig,
} from './runtime/config'
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
} from './node/types/config'

export type {
  Benchmark,
  BenchmarkResult,
  BenchFunction,
  BenchmarkAPI,
  BenchTaskResult,
  BenchOptions,
  BenchFactory,
  BenchTask,
} from './runtime/types/benchmark'
export type {
  /** @deprecated import from `vitest/node` instead */
  BenchmarkUserOptions,
} from './node/types/benchmark'

export type {
  TransformResultWithSource,
  WebSocketHandlers,
  WebSocketEvents,
  WebSocketRPC,
} from './api/types'
