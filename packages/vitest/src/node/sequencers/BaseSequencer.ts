import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'
import type { TestSequencer } from './types'
import { stat } from 'node:fs/promises'
import { slash } from '@vitest/utils/helpers'
import { resolve } from 'pathe'
import { hash } from '../hash'

export class BaseSequencer implements TestSequencer {
  protected ctx: Vitest

  constructor(ctx: Vitest) {
    this.ctx = ctx
  }

  // async so it can be extended by other sequencers
  public async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { config } = this.ctx
    const { index, count } = config.shard!
    const [shardStart, shardEnd] = this.calculateShardRange(files.length, index, count)
    return Array.from(files, (spec) => {
      const fullPath = resolve(slash(config.root), slash(spec.moduleId))
      const specPath = fullPath?.slice(config.root.length)
      return {
        spec,
        hash: hash('sha1', specPath, 'hex'),
      }
    })
      .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
      .slice(shardStart, shardEnd)
      .map(({ spec }) => spec)
  }

  // async so it can be extended by other sequencers
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const cache = this.ctx.cache
    const results = new Map(files.map((spec) => [spec, cache.getTestSpecificationResult(spec)]))
    // the size is only a fallback for files without results
    const sizes = files.some((spec) => !results.get(spec))
      ? await getFileSizes(files)
      : new Map<string, number>()
    return [...files].sort((a, b) => {
      // "sequence.groupOrder" is higher priority
      const groupOrderDiff =
        a.project.config.sequence.groupOrder - b.project.config.sequence.groupOrder
      if (groupOrderDiff !== 0) {
        return groupOrderDiff
      }

      // Projects run sequential
      if (a.project.name !== b.project.name) {
        return a.project.name < b.project.name ? -1 : 1
      }

      // Isolated run first
      if (a.project.config.isolate && !b.project.config.isolate) {
        return -1
      }
      if (!a.project.config.isolate && b.project.config.isolate) {
        return 1
      }

      const aState = results.get(a)
      const bState = results.get(b)

      if (!aState || !bState) {
        const sizeA = sizes.get(a.moduleId)
        const sizeB = sizes.get(b.moduleId)

        // run unknown first
        if (sizeA == null || sizeB == null) {
          return sizeA == null && sizeB != null ? -1 : sizeB == null && sizeA != null ? 1 : 0
        }

        // run larger files first
        return sizeB - sizeA
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

  // Calculate distributed shard range [start, end] distributed equally
  private calculateShardRange(filesCount: number, index: number, count: number): [number, number] {
    const baseShardSize = Math.floor(filesCount / count)
    const remainderTestFilesCount = filesCount % count
    if (remainderTestFilesCount >= index) {
      const shardSize = baseShardSize + 1
      const shardStart = shardSize * (index - 1)
      const shardEnd = shardSize * index
      return [shardStart, shardEnd]
    }

    const shardStart =
      remainderTestFilesCount * (baseShardSize + 1) +
      (index - remainderTestFilesCount - 1) * baseShardSize
    const shardEnd = shardStart + baseShardSize
    return [shardStart, shardEnd]
  }
}

async function getFileSizes(files: TestSpecification[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>()
  const moduleIds = new Set(files.map((spec) => spec.moduleId))
  await Promise.all(
    Array.from(moduleIds, async (moduleId) => {
      try {
        const stats = await stat(moduleId)
        sizes.set(moduleId, stats.size)
      } catch {
        // the file can be virtual or deleted; a file without
        // a size only loses the sorting heuristic
      }
    }),
  )
  return sizes
}
