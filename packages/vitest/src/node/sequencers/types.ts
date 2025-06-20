import type { Awaitable } from '../../types/general'
import type { Vitest } from '../core'
import type { TestSpecification } from '../spec'

export interface TestSequencer {
  /**
   * Slicing tests into shards. Will be run before `sort`.
   * Only run, if `shard` is defined.
   */
  shard: (files: TestSpecification[]) => Awaitable<TestSpecification[]>
  sort: (files: TestSpecification[]) => Awaitable<TestSpecification[]>
}

export interface TestSequencerConstructor {
  new (ctx: Vitest): TestSequencer
}
