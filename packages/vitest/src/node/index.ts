export type { Vitest } from './core'
export type { WorkspaceProject as VitestWorkspace } from './workspace'
export { createVitest } from './create'
export { VitestPlugin } from './plugins'
export { startVitest } from './cli-api'
export { registerConsoleShortcuts } from './stdin'
export type { WorkspaceSpec } from './pool'

export { VitestExecutor } from '../runtime/execute'
export type { ExecuteOptions } from '../runtime/execute'

export type { TestSequencer, TestSequencerConstructor } from './sequencers/types'
export { BaseSequencer } from './sequencers/BaseSequencer'
