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

export { distDir, rootDir } from '../paths'

export type {
  TestSequencer,
  TestSequencerConstructor,
} from './sequencers/types'
export { BaseSequencer } from './sequencers/BaseSequencer'

export type {
  BrowserProviderInitializationOptions,
  BrowserProvider,
  BrowserProviderOptions,
  BrowserScript,
  BrowserCommand,
  BrowserCommandContext,
} from '../types/browser'
export type { JsonOptions } from './reporters/json'
export type { JUnitOptions } from './reporters/junit'
export type { HTMLOptions } from './reporters/html'

export { isFileServingAllowed } from 'vite'
