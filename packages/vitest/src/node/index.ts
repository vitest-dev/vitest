export type { Vitest } from './core'
export type { WorkspaceProject } from './workspace'
export { createVitest } from './create'
export { VitestPlugin } from './plugins'
export { startVitest } from './cli-api'
export { registerConsoleShortcuts } from './stdin'
export type { WorkspaceSpec } from './pool'
export type { GlobalSetupContext } from './globalSetup'

export type { TestSequencer, TestSequencerConstructor } from './sequencers/types'
export { BaseSequencer } from './sequencers/BaseSequencer'

export { ensurePackageInstalled } from './pkg'
export type { BrowserProviderInitializationOptions, BrowserProvider, BrowserProviderOptions } from '../types/browser'
