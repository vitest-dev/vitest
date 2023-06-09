import type { Awaitable } from '../../types'
import type { Vitest } from '../core'
import type { WorkspaceSpec } from '../pool'

export interface TestSequencer {
  /**
   * Slicing tests into shards. Will be run before `sort`.
   * Only run, if `shard` is defined.
   */
  shard(files: WorkspaceSpec[]): Awaitable<WorkspaceSpec[]>
  sort(files: WorkspaceSpec[]): Awaitable<WorkspaceSpec[]>
}

export interface TestSequencerConstructor {
  new (ctx: Vitest): TestSequencer
}
