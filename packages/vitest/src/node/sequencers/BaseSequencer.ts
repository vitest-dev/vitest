import { createHash } from 'crypto'
import { resolve } from 'pathe'
import { slash } from 'vite-node/utils'
import type { Vitest } from '../core'
import type { TestSequencer } from './types'

export class BaseSequencer implements TestSequencer {
  protected ctx: Vitest

  constructor(ctx: Vitest) {
    this.ctx = ctx
  }

  // async so it can be extended by other sequelizers
  public async shard(files: string[]): Promise<string[]> {
    const { config } = this.ctx
    const { index, count } = config.shard!
    const shardSize = Math.ceil(files.length / count)
    const shardStart = shardSize * (index - 1)
    const shardEnd = shardSize * index
    return [...files]
      .map((file) => {
        const fullPath = resolve(slash(config.root), slash(file))
        const specPath = fullPath?.slice(config.root.length)
        return {
          file,
          hash: createHash('sha1')
            .update(specPath)
            .digest('hex'),
        }
      })
      .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
      .slice(shardStart, shardEnd)
      .map(({ file }) => file)
  }

  // async so it can be extended by other sequelizers
  public async sort(files: string[]): Promise<string[]> {
    const cache = this.ctx.cache
    return [...files].sort((a, b) => {
      const aState = cache.getFileTestResults(a)
      const bState = cache.getFileTestResults(b)

      if (!aState || !bState) {
        const statsA = cache.getFileStats(a)
        const statsB = cache.getFileStats(b)

        // run unknown first
        if (!statsA || !statsB)
          return !statsA && statsB ? -1 : !statsB && statsA ? 1 : 0

        // run larger files first
        return statsB.size - statsA.size
      }

      // run failed first
      if (aState.failed && !bState.failed)
        return -1
      if (!aState.failed && bState.failed)
        return 1

      // run longer first
      return bState.duration - aState.duration
    })
  }
}
