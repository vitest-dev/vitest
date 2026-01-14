import * as vite from 'vite'
import { Vitest } from '../node/core'

export const version: string = Vitest.version

export { isValidApiRequest } from '../api/check'
export { escapeTestName } from '../node/ast-collect'
export type { CacheKeyIdGenerator, CacheKeyIdGeneratorContext } from '../node/cache/fsModuleCache'
export { parseCLI } from '../node/cli/cac'
export type { CliParseOptions } from '../node/cli/cac'
export type { CliOptions } from '../node/cli/cli-api'
export { startVitest } from '../node/cli/cli-api'
export { resolveApiServerConfig } from '../node/config/resolveConfig'
export type {
  OnServerRestartHandler,
  OnTestsRerunHandler,
  Vitest,
  VitestOptions,
} from '../node/core'
export { BaseCoverageProvider } from '../node/coverage'
export { createVitest } from '../node/create'
export { GitNotFoundError, FilesNotFoundError as TestsNotFoundError } from '../node/errors'
export { VitestPackageInstaller } from '../node/packageInstaller'
export { VitestPlugin } from '../node/plugins'
export { resolveConfig } from '../node/plugins/publicConfig'
export { resolveFsAllow } from '../node/plugins/utils'
export type { ProcessPool } from '../node/pool'
export { getFilePoolName } from '../node/pool'
export { createMethodsRPC } from '../node/pools/rpc'
export type {
  PoolOptions,
  PoolRunnerInitializer,
  PoolTask,
  PoolWorker,
  WorkerRequest,
  WorkerResponse,
} from '../node/pools/types'
export { ForksPoolWorker } from '../node/pools/workers/forksWorker'
export { ThreadsPoolWorker } from '../node/pools/workers/threadsWorker'
export { TypecheckPoolWorker } from '../node/pools/workers/typecheckWorker'
export { VmForksPoolWorker } from '../node/pools/workers/vmForksWorker'
export { VmThreadsPoolWorker } from '../node/pools/workers/vmThreadsWorker'
export type { SerializedTestProject, TestProject } from '../node/project'

export {
  BenchmarkReporter,
  BenchmarkReportsMap,
  DefaultReporter,
  DotReporter,
  GithubActionsReporter,
  HangingProcessReporter,
  JsonReporter,
  JUnitReporter,
  ReportersMap,
  TapFlatReporter,
  TapReporter,
  VerboseBenchmarkReporter,
  VerboseReporter,
} from '../node/reporters'
export type {
  BaseReporter,
  BenchmarkBuiltinReporters,
  BuiltinReporterOptions,
  BuiltinReporters,
  JsonAssertionResult,
  JsonTestResult,
  JsonTestResults,
  ReportedHookContext,
  Reporter,
  TestRunEndReason,
} from '../node/reporters'
export type { HTMLOptions } from '../node/reporters/html'
export type { JsonOptions } from '../node/reporters/json'

export type { JUnitOptions } from '../node/reporters/junit'

export type {
  ModuleDiagnostic,
  TaskOptions,

  TestCase,
  TestCollection,
  TestDiagnostic,
  TestModule,
  TestModuleState,
  TestResult,
  TestResultFailed,
  TestResultPassed,
  TestResultSkipped,
  TestState,
  TestSuite,
  TestSuiteState,
} from '../node/reporters/reported-tasks'
export { experimental_getRunnerTask } from '../node/reporters/reported-tasks'
export { BaseSequencer } from '../node/sequencers/BaseSequencer'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from '../node/sequencers/types'
export { registerConsoleShortcuts } from '../node/stdin'
export type { TestSpecification, TestSpecificationOptions } from '../node/test-specification'
export type { BenchmarkUserOptions } from '../node/types/benchmark'

export type {
  _BrowserNames,
  BrowserBuiltinProvider,
  BrowserCommand,
  BrowserCommandContext,
  BrowserConfigOptions,
  BrowserInstanceOption,
  BrowserModuleMocker,
  BrowserOrchestrator,
  BrowserProvider,
  BrowserProviderOption,
  BrowserScript,
  BrowserServerFactory,
  BrowserServerOptions,
  BrowserServerState,
  BrowserServerStateSession,
  CDPSession,
  ParentProjectBrowser,
  ProjectBrowser,
  ResolvedBrowserOptions,
  ToMatchScreenshotComparators,
  ToMatchScreenshotOptions,
} from '../node/types/browser'
export const createViteServer: typeof vite.createServer = vite.createServer
export type {
  ApiConfig,
  BuiltinEnvironment,
  CSSModuleScopeStrategy,
  DepsOptimizationOptions,
  EnvironmentOptions,
  InlineConfig,
  Pool,
  ProjectConfig,
  ResolvedConfig,
  ResolvedProjectConfig,
  ResolveSnapshotPathHandler,
  ResolveSnapshotPathHandlerContext,
  RuntimeConfig,
  SequenceHooks,
  SequenceSetupFiles,
  UserConfig as TestUserConfig,
  TypecheckConfig,
  UserWorkspaceConfig,
  VitestEnvironment,
  VitestRunMode,
} from '../node/types/config'
export type {
  BaseCoverageOptions,
  CoverageIstanbulOptions,
  CoverageOptions,
  CoverageProvider,
  CoverageProviderModule,
  CoverageReporter,
  CoverageV8Options,
  CustomProviderOptions,
  ReportContext,
  ResolvedCoverageOptions,
} from '../node/types/coverage'

export type { VitestPluginContext } from '../node/types/plugin'
export type { TestRunResult } from '../node/types/tests'
export type { WorkerContext } from '../node/types/worker'
export { isFileServingAllowed } from '../node/vite'
export { createViteLogger } from '../node/viteLogger'
export type { WatcherTriggerPattern } from '../node/watcher'

export { distDir, rootDir } from '../paths'

export type {
  CollectLineNumbers as TypeCheckCollectLineNumbers,
  CollectLines as TypeCheckCollectLines,
  Context as TypeCheckContext,
  TscErrorInfo as TypeCheckErrorInfo,
  RawErrsMap as TypeCheckRawErrorsMap,
  RootAndTarget as TypeCheckRootAndTarget,
} from '../typecheck/types'

export type { TestExecutionMethod as TestExecutionType } from '../types/worker'
export { createDebugger } from '../utils/debugger'
export type {
  RunnerTask,
  RunnerTaskResult,
  RunnerTaskResultPack,
  RunnerTestCase,
  RunnerTestFile,
  RunnerTestSuite,
} from './index'
export { generateFileHash } from '@vitest/runner/utils'
export type { SerializedError } from '@vitest/utils'

export {
  esbuildVersion,
  isCSSRequest,
  isFileLoadingAllowed,
  parseAst,
  parseAstAsync,
  rollupVersion,
  version as viteVersion,
} from 'vite'

// rolldownVersion is exported only by rolldown-vite
export const rolldownVersion: string | undefined = (vite as any).rolldownVersion

export type * as Vite from 'vite'
