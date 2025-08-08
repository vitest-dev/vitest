import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('hook errors do not break concurrency limiting', async () => {
  const { stdout, stderr, exitCode } = await runVitest({
    root: './fixtures/hook-errors',
    config: './vitest.config.maxConcurrency1.ts',
  })
  
  // Should have failures but not crash
  expect(exitCode).toBe(1)
  
  // Error hook should fail
  expect(stderr).toContain('Hook failed intentionally')
  
  // But other hooks should still run (in sequence)
  expect(stdout).toContain('Hook success-1 completed')
  expect(stdout).toContain('Hook success-2 completed')
  
  // Verify sequential execution despite error
  // The timings are Unix timestamps, so we look at the start times
  const startTimings = [...stdout.matchAll(/Hook (\w+) started at (\d+)ms/g)]
    .map(m => ({ name: m[1], time: parseInt(m[2]) }))
    .sort((a, b) => a.time - b.time)
  
  // With maxConcurrency=1, hooks should start sequentially
  // The fail-first hook takes 500ms, success hooks take 1000ms
  if (startTimings.length >= 2) {
    // First hook should complete (or fail) before second starts
    const gap = startTimings[1].time - startTimings[0].time
    expect(gap).toBeGreaterThanOrEqual(450) // Allow some variance, fail-first takes ~500ms
  }
})

test('hook errors propagate correctly with concurrency limits', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/hook-errors',
    config: './vitest.config.maxConcurrency2.ts',
  })
  
  // Should still fail when hooks error
  expect(exitCode).toBe(1)
  
  // All errors should be reported
  expect(stderr).toContain('Hook failed intentionally')
  
  // Test failure should be associated with correct suite
  expect(stderr).toContain('fail-first')
})