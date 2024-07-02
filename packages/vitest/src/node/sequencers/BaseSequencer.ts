import { createHash } from 'node:crypto'
import { relative, resolve } from 'pathe'
import { slash } from 'vite-node/utils'
import type { Vitest } from '../core'
import type { WorkspaceSpec } from '../pool'
import type { TestSequencer } from './types'

export class BaseSequencer implements TestSequencer {
  protected ctx: Vitest

  constructor(ctx: Vitest) {
    this.ctx = ctx
  }

  // async so it can be extended by other sequelizers
  public async shard(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    const { config } = this.ctx
    const { index, count } = config.shard!
    const shardSize = Math.ceil(files.length / count)
    const shardStart = shardSize * (index - 1)
    const shardEnd = shardSize * index
    return [...files]
      .map((spec) => {
        const fullPath = resolve(slash(config.root), slash(spec[1]))
        const specPath = fullPath?.slice(config.root.length)
        return {
          spec,
          hash: createHash('sha1').update(specPath).digest('hex'),
        }
      })
      .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
      .slice(shardStart, shardEnd)
      .map(({ spec }) => spec)
  }

  // async so it can be extended by other sequelizers
  public async sort(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    const cache = this.ctx.cache
    return [...files].sort((a, b) => {
      const keyA = `${a[0].getName()}:${relative(this.ctx.config.root, a[1])}`
      const keyB = `${b[0].getName()}:${relative(this.ctx.config.root, b[1])}`

      const aState = cache.getFileTestResults(keyA)
      const bState = cache.getFileTestResults(keyB)

      if (!aState || !bState) {
        const statsA = cache.getFileStats(keyA)
        const statsB = cache.getFileStats(keyB)

        // run unknown first
        if (!statsA || !statsB) {
          return !statsA && statsB ? -1 : !statsB && statsA ? 1 : 0
        }

        // run larger files first
        return statsB.size - statsA.size
      }

      // run failed first
      if (aState.failed && !bState.failed) {
        return -1
      }
      if (!aState.failed && bState.failed) {
        return 1
      }

      // run longer first
      return bState.duration - aState.duration
    })
  }
}
