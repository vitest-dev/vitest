export type { Vitest } from './core'
export type { WorkspaceProject } from './workspace'
export { createVitest } from './create'
export { VitestPlugin } from './plugins'
export { startVitest } from './cli/cli-api'
export { parseCLI } from './cli/cac'
export { registerConsoleShortcuts } from './stdin'
export type { GlobalSetupContext } from './globalSetup'
export type { WorkspaceSpec, ProcessPool } from './pool'
export { createMethodsRPC } from './pools/rpc'
export { getFilePoolName } from './pool'
export { VitestPackageInstaller } from './packageInstaller'
export { createDebugger } from '../utils/debugger'
export { resolveFsAllow } from './plugins/utils'
export { resolveApiServerConfig, resolveConfig } from './config/resolveConfig'

export { GitNotFoundError, FilesNotFoundError as TestsNotFoundError } from './errors'

export { distDir, rootDir } from '../paths'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from './sequencers/types'
export { BaseSequencer } from './sequencers/BaseSequencer'

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
} from './types/browser'
export type { JsonOptions } from './reporters/json'
export type { JUnitOptions } from './reporters/junit'
export type { HTMLOptions } from './reporters/html'

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
} from './types/config'

export type { BenchmarkUserOptions } from './types/benchmark'

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
} from './types/coverage'
