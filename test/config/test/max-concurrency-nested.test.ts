import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('nested suites respect concurrency', async () => {
  const { stdout, exitCode } = await runVitest({
    root: './fixtures/nested-hooks',
    config: './vitest.config.maxConcurrency1.ts',
  })
  
  expect(exitCode).toBe(0)
  
  // Should see parent hooks, then child hooks
  const hookOrder = [...stdout.matchAll(/Hook ([\w-]+) executed/g)]
    .map(m => m[1])
  
  // Parent hooks should run before child hooks due to nesting
  const parentIndex = hookOrder.indexOf('parent')
  const child1Index = hookOrder.indexOf('child-1')
  const child2Index = hookOrder.indexOf('child-2')
  
  expect(parentIndex).toBeGreaterThanOrEqual(0)
  expect(child1Index).toBeGreaterThanOrEqual(0)
  expect(child2Index).toBeGreaterThanOrEqual(0)
  
  // Parent should execute before children
  expect(parentIndex).toBeLessThan(child1Index)
  expect(parentIndex).toBeLessThan(child2Index)
  
  // All hooks should respect concurrency limit (sequential timing)
  // Parse hook start times (Unix timestamps)
  const startTimings = [...stdout.matchAll(/Hook ([\w-]+) started at (\d+)ms/g)]
    .map(m => ({ name: m[1], time: parseInt(m[2]) }))
    .sort((a, b) => a.time - b.time)
  
  // With maxConcurrency=1, hooks should be sequential
  // Each hook should start after the previous one completes (~1000ms)
  if (startTimings.length >= 2) {
    for (let i = 1; i < startTimings.length; i++) {
      const gap = startTimings[i].time - startTimings[i-1].time
      // Each hook takes ~1000ms, so gap should be at least 900ms
      expect(gap).toBeGreaterThanOrEqual(900)
    }
  }
})

test('nested suites with mixed hook types', async () => {
  const { stdout, exitCode } = await runVitest({
    root: './fixtures/nested-hooks',
    config: './vitest.config.mixedHooks.ts',
  })
  
  expect(exitCode).toBe(0)
  
  // Verify all hook types ran
  expect(stdout).toContain('parent-beforeAll')
  expect(stdout).toContain('parent-afterAll')
  expect(stdout).toContain('child-beforeAll-child-1')
  expect(stdout).toContain('child-afterAll-child-1')
})