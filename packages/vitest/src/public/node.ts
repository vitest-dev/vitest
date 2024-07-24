export type { Vitest } from '../node/core'
export type { WorkspaceProject } from '../node/workspace'
export { createVitest } from '../node/create'
export { VitestPlugin } from '../node/plugins'
export { startVitest } from '../node/cli/cli-api'
export { parseCLI } from '../node/cli/cac'
export { registerConsoleShortcuts } from '../node/stdin'
export type { GlobalSetupContext } from '../node/globalSetup'
export type { WorkspaceSpec, ProcessPool } from '../node/pool'
export { createMethodsRPC } from '../node/pools/rpc'
export { getFilePoolName } from '../node/pool'
export { VitestPackageInstaller } from '../node/packageInstaller'
export { createDebugger } from '../utils/debugger'
export { resolveFsAllow } from '../node/plugins/utils'
export { resolveApiServerConfig, resolveConfig } from '../node/config/resolveConfig'

export { GitNotFoundError, FilesNotFoundError as TestsNotFoundError } from '../node/errors'

export { distDir, rootDir } from '../paths'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from '../node/sequencers/types'
export { BaseSequencer } from '../node/sequencers/BaseSequencer'

export type {
  BrowserProviderInitializationOptions,
  BrowserProvider,
  CDPSession,
  BrowserProviderModule,
  ResolvedBrowserOptions,
  BrowserProviderOptions,
  BrowserBuiltinProvider,
  BrowserScript,
  BrowserCommand,
  BrowserCommandContext,
  BrowserServer,
  BrowserServerState,
  BrowserServerStateContext,
  BrowserOrchestrator,
  BrowserConfigOptions,
} from '../node/types/browser'
export type { JsonOptions } from '../node/reporters/json'
export type { JUnitOptions } from '../node/reporters/junit'
export type { HTMLOptions } from '../node/reporters/html'

export { isFileServingAllowed, createServer, parseAst, parseAstAsync } from 'vite'
export type * as Vite from 'vite'

export type {
  SequenceHooks,
  SequenceSetupFiles,
  BuiltinEnvironment,
  VitestEnvironment,
  Pool,
  PoolOptions,
  CSSModuleScopeStrategy,
  ApiConfig,
  JSDOMOptions,
  HappyDOMOptions,
  EnvironmentOptions,
  VitestRunMode,
  DepsOptimizationOptions,
  TransformModePatterns,
  InlineConfig,
  TypecheckConfig,
  UserConfig,
  ResolvedConfig,
  ProjectConfig,
  UserWorkspaceConfig,
  RuntimeConfig,
} from '../node/types/config'

export type { BenchmarkUserOptions } from '../node/types/benchmark'

export type {
  RawErrsMap,
  TscErrorInfo,
  CollectLineNumbers,
  CollectLines,
  RootAndTarget,
  Context,
} from '../typecheck/types'

export type { OnServerRestartHandler } from '../types/general'

export type {
  CoverageProvider,
  ReportContext,
  CoverageProviderModule,
  CoverageReporter,
  CoverageOptions,
  ResolvedCoverageOptions,
  BaseCoverageOptions,
  CoverageIstanbulOptions,
  CoverageV8Options,
  CustomProviderOptions,
} from '../node/types/coverage'

export type { WorkerContext } from '../node/types/worker'
