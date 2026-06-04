import { describe, expect, it } from 'vitest'
import { getWorkerMemoryLimit } from 'vitest/src/utils/memory-limit.js'

describe('getWorkerMemoryLimit', () => {
  it('should prioritize vmMemoryLimit', () => {
    expect(getWorkerMemoryLimit({ vmMemoryLimit: '512MB', maxWorkers: 1, watch: false })).toBe('512MB')
  })

  it('should calculate 1/maxWorkers', () => {
    expect(getWorkerMemoryLimit({ maxWorkers: 4, watch: false })).toBe(1 / 4)
  })

  it('should calculate maxWorkers/2 when in watch-mode', () => {
    expect(getWorkerMemoryLimit({ maxWorkers: 14, watch: true })).toBe(1 / 14)
  })
})
