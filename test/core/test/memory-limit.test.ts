import type { PoolOptions, ResolvedConfig } from 'vitest/node'
import { describe, expect, it } from 'vitest'
import { getWorkerMemoryLimit } from 'vitest/src/utils/memory-limit.js'

function makeConfig(poolOptions: PoolOptions): ResolvedConfig {
  return {
    poolOptions: {
      vmForks: {
        maxForks: poolOptions.maxForks,
        memoryLimit: poolOptions.memoryLimit,
      },
      vmThreads: {
        maxThreads: poolOptions.maxThreads,
        memoryLimit: poolOptions.memoryLimit,
      },
    },
  } as ResolvedConfig
}

describe('getWorkerMemoryLimit', () => {
  it('should prioritize vmThreads.memoryLimit when pool is vmThreads', () => {
    const config = {
      poolOptions: {
        vmForks: { memoryLimit: undefined },
        vmThreads: { memoryLimit: '256MB' },
      },
    } as ResolvedConfig

    expect(getWorkerMemoryLimit(config, 'vmThreads')).toBe('256MB')
  })

  it('should prioritize vmForks.memoryLimit when pool is vmForks', () => {
    const config = makeConfig({ memoryLimit: '512MB' })
    expect(getWorkerMemoryLimit(config, 'vmForks')).toBe('512MB')
  })

  it('should calculate 1/maxThreads when vmThreads.memoryLimit is unset', () => {
    const config = makeConfig({ maxThreads: 4 })
    expect(getWorkerMemoryLimit(config, 'vmThreads')).toBe(1 / 4)
  })

  it('should calculate 1/maxForks when vmForks.memoryLimit is unset', () => {
    const config = makeConfig({ maxForks: 4 })
    expect(getWorkerMemoryLimit(config, 'vmForks')).toBe(1 / 4)
  })
})
