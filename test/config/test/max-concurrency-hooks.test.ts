import { expect, test, describe } from 'vitest'
import { runVitest } from '../../test-utils'

describe('maxConcurrency hook enforcement', () => {
  test('issue #8367 - beforeAll hooks respect maxConcurrency=1', async () => {
    const { stdout, stderr, exitCode } = await runVitest({
      root: './fixtures/issue-8367',
      config: './vitest.config.maxConcurrency1.ts',
    })
    
    expect(exitCode).toBe(0)
    
    // Parse execution timing from console output
    const lines = stdout.split('\n')
    const hookStarts = lines
      .filter(line => line.includes('beforeAll start:'))
      .map(line => {
        const match = line.match(/beforeAll start: (\w+) at (\d+)ms/)
        return match ? { name: match[1], time: parseInt(match[2]) } : null
      })
      .filter(Boolean)
    
    expect(hookStarts).toHaveLength(2) // Should have hooks for 'a' and 'b'
    
    // With maxConcurrency=1, second hook should start after first completes (~1000ms later)
    const timeDiff = hookStarts[1].time - hookStarts[0].time
    expect(timeDiff).toBeGreaterThanOrEqual(900) // Allow some timing variance
    expect(timeDiff).toBeLessThan(1500) // But not too much
    
    // Verify both hooks actually ran
    expect(stdout).toContain('beforeAll end: a')
    expect(stdout).toContain('beforeAll end: b')
  })

  test('maxConcurrency=2 allows parallel execution', async () => {
    const { stdout, exitCode } = await runVitest({
      root: './fixtures/issue-8367',
      config: './vitest.config.maxConcurrency2.ts',
    })
    
    expect(exitCode).toBe(0)
    
    const lines = stdout.split('\n')
    const hookStarts = lines
      .filter(line => line.includes('beforeAll start:'))
      .map(line => {
        const match = line.match(/beforeAll start: (\w+) at (\d+)ms/)
        return match ? { name: match[1], time: parseInt(match[2]) } : null
      })
      .filter(Boolean)
    
    // With maxConcurrency=2 and only 2 hooks, both should start nearly simultaneously
    const timeDiff = hookStarts[1].time - hookStarts[0].time
    expect(timeDiff).toBeLessThan(100) // Should start within 100ms of each other
  })

  test('maxConcurrency applies to multiple suites', async () => {
    const { stdout, exitCode } = await runVitest({
      root: './fixtures/max-concurrency-mixed',
      config: './vitest.config.maxConcurrency1.ts',
    })
    
    expect(exitCode).toBe(0)
    
    // Verify all hooks ran but were throttled
    const hookExecutions = stdout.match(/Hook beforeAll-\w+ executed at \d+ms/g) || []
    expect(hookExecutions).toHaveLength(4) // 4 suites
    
    // Parse timings (they should be sequential with maxConcurrency=1)
    const timings = hookExecutions
      .map(exec => parseInt(exec.match(/at (\d+)ms/)?.[1] || '0'))
      .sort((a, b) => a - b)
    
    // Each beforeAll hook should start at least 900ms after the previous one
    for (let i = 1; i < timings.length; i++) {
      const gap = timings[i] - timings[i - 1]
      expect(gap).toBeGreaterThanOrEqual(900)
    }
  })
})