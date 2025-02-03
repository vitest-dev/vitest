import type { ModuleDiagnostic as _FileDiagnostic } from '../node/reporters/reported-tasks'
import { createServer as _createServer } from 'vite'
import { Vitest } from '../node/core'
import { TestModule as _TestFile } from '../node/reporters/reported-tasks'

export const version = Vitest.version

export { isValidApiRequest } from '../api/check'
export { parseCLI } from '../node/cli/cac'
export type { CliParseOptions } from '../node/cli/cac'
export { startVitest } from '../node/cli/cli-api'
export { resolveApiServerConfig } from '../node/config/resolveConfig'
export type {
  OnServerRestartHandler,
  OnTestsRerunHandler,
  Vitest,
  VitestOptions,
} from '../node/core'
export { createVitest } from '../node/create'
export { GitNotFoundError, FilesNotFoundError as TestsNotFoundError } from '../node/errors'
export type { GlobalSetupContext } from '../node/globalSetup'
export { VitestPackageInstaller } from '../node/packageInstaller'
export { VitestPlugin } from '../node/plugins'
export { resolveConfig } from '../node/plugins/publicConfig'
export { resolveFsAllow } from '../node/plugins/utils'
export type { ProcessPool, WorkspaceSpec } from '../node/pool'
export { getFilePoolName } from '../node/pool'
export { createMethodsRPC } from '../node/pools/rpc'
export type { SerializedTestProject, TestProject } from '../node/project'
export type { WorkspaceProject } from '../node/project'
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
export { BaseSequencer } from '../node/sequencers/BaseSequencer'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from '../node/sequencers/types'
export type { TestSpecification } from '../node/spec'
export { registerConsoleShortcuts } from '../node/stdin'
export type { BenchmarkUserOptions } from '../node/types/benchmark'

export type {
  BrowserBuiltinProvider,
  BrowserCommand,
  BrowserCommandContext,
  BrowserConfigOptions,
  BrowserInstanceOption,
  BrowserOrchestrator,
  BrowserProvider,
  BrowserProviderInitializationOptions,
  BrowserProviderModule,
  BrowserProviderOptions,
  BrowserScript,
  BrowserServerState,
  BrowserServerStateSession,
  CDPSession,
  ParentProjectBrowser,
  ProjectBrowser,
  ResolvedBrowserOptions,
} from '../node/types/browser'
/** @deprecated use `createViteServer` instead */
export const createServer = _createServer
export const createViteServer = _createServer
export type {
  ApiConfig,
  BuiltinEnvironment,
  CSSModuleScopeStrategy,
  DepsOptimizationOptions,
  EnvironmentOptions,
  HappyDOMOptions,
  InlineConfig,
  JSDOMOptions,
  Pool,
  PoolOptions,
  ProjectConfig,
  ResolvedConfig,
  ResolvedProjectConfig,
  ResolveSnapshotPathHandler,
  ResolveSnapshotPathHandlerContext,
  RuntimeConfig,
  SequenceHooks,
  SequenceSetupFiles,
  TransformModePatterns,
  TypecheckConfig,
  UserConfig,
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

export type { TestRunResult } from '../node/types/tests'
/**
 * @deprecated Use `TestModule` instead
 */
export const TestFile = _TestFile
export type { WorkerContext } from '../node/types/worker'
export { createViteLogger } from '../node/viteLogger'

/**
 * @deprecated Use `ModuleDiagnostic` instead
 */
export type FileDiagnostic = _FileDiagnostic

export { distDir, rootDir } from '../paths'

export type {
  CollectLineNumbers as TypeCheckCollectLineNumbers,
  CollectLines as TypeCheckCollectLines,
  Context as TypeCheckContext,
  TscErrorInfo as TypeCheckErrorInfo,
  RawErrsMap as TypeCheckRawErrorsMap,
  RootAndTarget as TypeCheckRootAndTarget,
} from '../typecheck/types'

export { createDebugger } from '../utils/debugger'

export type {
  RunnerTask,
  RunnerTaskResult,
  RunnerTaskResultPack,
  RunnerTestCase,
  RunnerTestFile,
  RunnerTestSuite,
} from './index'
export type {
  ReportedHookContext,
  Reporter,
  TestRunEndReason,
} from './reporters'
export { generateFileHash } from '@vitest/runner/utils'
export type { SerializedError } from '@vitest/utils'

export {
  esbuildVersion,
  isFileServingAllowed,
  parseAst,
  parseAstAsync,
  rollupVersion,
  version as viteVersion,
} from 'vite'

export type * as Vite from 'vite'
