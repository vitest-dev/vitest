import { describe, expect, it } from 'vitest'
import { getWorkerMemoryLimit } from '../../../packages/vitest/src/utils/memory-limit.js'

describe('getWorkerMemoryLimit', () => {
  it('should prioritize vmMemoryLimit', () => {
    expect(getWorkerMemoryLimit({ vmMemoryLimit: '512MB', maxWorkers: 1 })).toBe('512MB')
  })

  it('should calculate 1/maxWorkers', () => {
    expect(getWorkerMemoryLimit({ maxWorkers: 4 })).toBe(1 / 4)
  })
})
