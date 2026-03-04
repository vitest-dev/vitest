import type { Awaitable } from '@vitest/utils'
import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'

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
