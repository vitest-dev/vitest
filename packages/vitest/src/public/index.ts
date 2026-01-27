import type { SerializedTestSpecification } from '../runtime/types/utils'
import type {
  ModuleDefinitionDiagnostic,
  ModuleDefinitionDurationsDiagnostic,
  ModuleDefinitionLocation,
  SourceModuleDiagnostic,
  SourceModuleLocations,
  UntrackedModuleDefinitionDiagnostic,
} from '../types/module-locations'
import '../types/global'

// eslint-disable-next-line ts/no-namespace
export declare namespace Experimental {
  export {
    ModuleDefinitionDiagnostic,
    ModuleDefinitionDurationsDiagnostic,
    ModuleDefinitionLocation,
    SourceModuleDiagnostic,
    SourceModuleLocations,
    UntrackedModuleDefinitionDiagnostic,
  }
}

export type {
  ExternalResult,
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

export { VitestEvaluatedModules as EvaluatedModules } from '../runtime/moduleRunner/evaluatedModules'

export { NodeBenchmarkRunner as BenchmarkRunner } from '../runtime/runners/benchmark'
export { TestRunner } from '../runtime/runners/test'
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
  RawMatcherFn as Matcher,
  ExpectationResult as MatcherResult,
  Matchers,
  MatcherState,
} from '@vitest/expect'
export {
  afterAll,
  afterEach,
  aroundAll,
  aroundEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  onTestFailed,
  onTestFinished,
  recordArtifact,
  suite,
  test,
} from '@vitest/runner'
export type {
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
  SuiteOptions,
  TaskCustomOptions,
  TaskMeta,
  TaskState,
  TestAnnotation,
  TestAnnotationArtifact,
  TestAPI,
  TestArtifact,
  TestArtifactBase,
  TestArtifactLocation,
  TestArtifactRegistry,
  TestAttachment,
  TestContext,
  TestFunction,
  TestOptions,
  VitestRunnerConfig as TestRunnerConfig,

  TestTags,
  VitestRunner as VitestTestRunner,
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
  MockResult,
  MockResultIncomplete,
  MockResultReturn,
  MockResultThrow,
  MockSettledResult,
  MockSettledResultFulfilled,
  MockSettledResultIncomplete,
  MockSettledResultRejected,
} from '@vitest/spy'

export type { SerializedError } from '@vitest/utils'
export type { SerializedTestSpecification }
export type { DiffOptions } from '@vitest/utils/diff'
