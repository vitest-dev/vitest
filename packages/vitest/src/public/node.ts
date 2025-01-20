import type { ModuleDiagnostic as _FileDiagnostic } from '../node/reporters/reported-tasks'
import { createServer as _createServer } from 'vite'
import { TestModule as _TestFile } from '../node/reporters/reported-tasks'

export { isWebsocketRequestAllowed } from '../api/hostCheck'
export { parseCLI } from '../node/cli/cac'
export { startVitest } from '../node/cli/cli-api'
export { resolveApiServerConfig, resolveConfig } from '../node/config/resolveConfig'
export type { Vitest } from '../node/core'
export { createVitest } from '../node/create'
export { FilesNotFoundError as TestsNotFoundError, GitNotFoundError } from '../node/errors'
export type { GlobalSetupContext } from '../node/globalSetup'
export { VitestPackageInstaller } from '../node/packageInstaller'
export { VitestPlugin } from '../node/plugins'
export { resolveFsAllow } from '../node/plugins/utils'
export type { ProcessPool, WorkspaceSpec } from '../node/pool'
export { getFilePoolName } from '../node/pool'
export { createMethodsRPC } from '../node/pools/rpc'
export { TestProject } from '../node/reported-workspace-project'
export type { SerializedTestProject } from '../node/reported-workspace-project'
export type { HTMLOptions } from '../node/reporters/html'
export type { JsonOptions } from '../node/reporters/json'

export type { JUnitOptions } from '../node/reporters/junit'

export { TestCase, TestModule, TestSuite } from '../node/reporters/reported-tasks'

export type {
  ModuleDiagnostic,

  TaskOptions,
  TestCollection,
  TestDiagnostic,
  TestResult,
  TestResultFailed,
  TestResultPassed,
  TestResultSkipped,
} from '../node/reporters/reported-tasks'
export { BaseSequencer } from '../node/sequencers/BaseSequencer'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from '../node/sequencers/types'
export { TestSpecification } from '../node/spec'
export { registerConsoleShortcuts } from '../node/stdin'
export type { BenchmarkUserOptions } from '../node/types/benchmark'

export type {
  BrowserBuiltinProvider,
  BrowserCommand,
  BrowserCommandContext,
  BrowserConfigOptions,
  BrowserOrchestrator,
  BrowserProvider,
  BrowserProviderInitializationOptions,
  BrowserProviderModule,
  BrowserProviderOptions,
  BrowserScript,
  BrowserServer,
  BrowserServerState,
  BrowserServerStateContext,
  CDPSession,
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
/**
 * @deprecated Use `TestModule` instead
 */
export const TestFile = _TestFile
export type { WorkerContext } from '../node/types/worker'
export { createViteLogger } from '../node/viteLogger'
export type { WorkspaceProject } from '../node/workspace'

/**
 * @deprecated Use `ModuleDiagnostic` instead
 */
export type FileDiagnostic = _FileDiagnostic

export { distDir, rootDir } from '../paths'

export type {
  CollectLineNumbers as TypeCheckCollectLineNumbers,
  CollectLines as TypeCheckCollectLines,
  Context as TypeCheckContext,
  RawErrsMap as TypeCheckRawErrorsMap,
  RootAndTarget as TypeCheckRootAndTarget,
  TscErrorInfo as TypeCheckErrorInfo,
} from '../typecheck/types'

export type { OnServerRestartHandler } from '../types/general'

export { createDebugger } from '../utils/debugger'

export {
  isFileServingAllowed,
  parseAst,
  parseAstAsync,
} from 'vite'

export type * as Vite from 'vite'
