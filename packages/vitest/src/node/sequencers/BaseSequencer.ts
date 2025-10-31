import type { Vitest } from '../core'
import type { TestSpecification } from '../spec'
import type { TestSequencer } from './types'
import { slash } from '@vitest/utils/helpers'
import { relative, resolve } from 'pathe'
import { hash } from '../hash'

export class BaseSequencer implements TestSequencer {
  protected ctx: Vitest

  constructor(ctx: Vitest) {
    this.ctx = ctx
  }

  // async so it can be extended by other sequelizers
  public async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { config } = this.ctx
    const { index, count } = config.shard!
    const [shardStart, shardEnd] = this.calculateShardRange(files.length, index, count)
    return [...files]
      .map((spec) => {
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

  // async so it can be extended by other sequelizers
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const cache = this.ctx.cache
    const environments = await this.ctx._getSpecificationsEnvironments(files)

    // Comparator that follows existing heuristics
    const compareByHeuristics = (a: TestSpecification, b: TestSpecification) => {
      const keyA = `${a.project.name}:${relative(this.ctx.config.root, a.moduleId)}`
      const keyB = `${b.project.name}:${relative(this.ctx.config.root, b.moduleId)}`

      const aState = cache.getFileTestResults(keyA)
      const bState = cache.getFileTestResults(keyB)

      if (!aState || !bState) {
        const statsA = cache.getFileStats(keyA)
        const statsB = cache.getFileStats(keyB)
        if (!statsA || !statsB) {
          return !statsA && statsB ? -1 : !statsB && statsA ? 1 : 0
        }
        return statsB.size - statsA.size
      }

      if (aState.failed && !bState.failed) {
        return -1
      }
      if (!aState.failed && bState.failed) {
        return 1
      }

      return bState.duration - aState.duration
    }

    // Build groups by groupOrder
    const groups = new Map<number, TestSpecification[]>()
    for (const spec of files) {
      const order = spec.project.config.sequence.groupOrder
      const list = groups.get(order)
      if (list) {
        list.push(spec)
      }
      else { groups.set(order, [spec]) }
    }

    const sortedOrders = Array.from(groups.keys()).sort((a, b) => a - b)
    const result: TestSpecification[] = []
    const deferredIsolatedMaxOne: TestSpecification[] = []

    function isIsolatedMaxOne(spec: TestSpecification) {
      const p = spec.project
      const isolated = p.config.isolate === true
      const maxOne = p.config.maxWorkers === 1 || p.vitest.config.maxWorkers === 1
      return isolated && maxOne
    }

    function runnerKey(spec: TestSpecification) {
      const env = environments.get(spec)
      const envName = env?.name || ''
      const envOpts = env?.options ? JSON.stringify(env.options) : ''
      return `${spec.project.name}|${spec.pool}|${envName}|${envOpts}`
    }

    for (const order of sortedOrders) {
      const specs = groups.get(order)!
      const normals: TestSpecification[] = []

      for (const spec of specs) {
        if (isIsolatedMaxOne(spec)) {
          deferredIsolatedMaxOne.push(spec)
        }
        else {
          normals.push(spec)
        }
      }

      // Cluster by runner identity to maximize reuse
      const clusters = new Map<string, TestSpecification[]>()
      for (const spec of normals) {
        const key = runnerKey(spec)
        const arr = clusters.get(key)
        if (arr) {
          arr.push(spec)
        }
        else { clusters.set(key, [spec]) }
      }

      // Append clusters; stable by key to keep determinism
      for (const key of Array.from(clusters.keys()).sort()) {
        const cluster = clusters.get(key)!
        cluster.sort(compareByHeuristics)
        result.push(...cluster)
      }
    }

    // Defer isolated maxWorkers:1 tests to the end (sorted by heuristics)
    deferredIsolatedMaxOne.sort(compareByHeuristics)
    result.push(...deferredIsolatedMaxOne)

    return result
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

    const shardStart = remainderTestFilesCount * (baseShardSize + 1) + (index - remainderTestFilesCount - 1) * baseShardSize
    const shardEnd = shardStart + baseShardSize
    return [shardStart, shardEnd]
  }
}
