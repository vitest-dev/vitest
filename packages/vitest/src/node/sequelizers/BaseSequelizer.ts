import { createHash } from 'crypto'
import { resolve } from 'pathe'
import { slash } from 'vite-node/utils'
import type { Vitest } from '../core'
import type { TestSequelizer } from './types'

export class BaseSequelizer implements TestSequelizer {
  protected ctx: Vitest

  constructor(ctx: Vitest) {
    this.ctx = ctx
  }

  // async so it can be extended by other sequelizers
  public async shard(files: string[]): Promise<string[]> {
    const config = this.ctx.getSerializableConfig()
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
    const ctx = this.ctx
    return [...files].sort((a, b) => {
      const aState = ctx.state.getFileTestResults(a)
      const bState = ctx.state.getFileTestResults(b)

      if (!aState || !bState) {
        const statsA = ctx.state.getFileStats(a)
        const statsB = ctx.state.getFileStats(b)

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
