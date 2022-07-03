import type { Awaitable } from '../../types'
import type { Vitest } from '../core'

export interface TestSequelizer {
  /**
   * Slicing tests into shards. Will be run before `sort`.
   * Only run, if `shard` is defined.
   */
  shard(files: string[]): Awaitable<string[]>
  sort(files: string[]): Awaitable<string[]>
}

export interface TestSequelizerContructor {
  new (ctx: Vitest): TestSequelizer
}
