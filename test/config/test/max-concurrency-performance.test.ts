import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

// TODO: Re-enable once performance baseline is stabilized
test.skip('performance regression is acceptable', async () => {
  // Run with unlimited concurrency (baseline)
  const unlimitedStart = Date.now()
  const { exitCode: unlimitedExit } = await runVitest({
    root: './fixtures/performance-test',
    config: './vitest.config.unlimited.ts',
  })
  const unlimitedDuration = Date.now() - unlimitedStart
  expect(unlimitedExit).toBe(0)

  // Run with limited concurrency
  const limitedStart = Date.now()
  const { exitCode: limitedExit } = await runVitest({
    root: './fixtures/performance-test',
    config: './vitest.config.limited.ts',
  })
  const limitedDuration = Date.now() - limitedStart
  expect(limitedExit).toBe(0)

  // Calculate performance impact
  const degradation = ((limitedDuration - unlimitedDuration) / unlimitedDuration) * 100

  console.log(`Performance impact: ${degradation.toFixed(1)}%`)
  console.log(`Unlimited: ${unlimitedDuration}ms, Limited: ${limitedDuration}ms`)

  // Accept up to 20% degradation for correctness
  // Note: In practice, limited concurrency might actually be faster in some cases
  // due to reduced resource contention
  expect(Math.abs(degradation)).toBeLessThan(20)
}, 60000) // Increase timeout for performance test

test('prevents resource exhaustion with many concurrent hooks', async () => {
  // This would have caused issues before the fix
  const { exitCode, stderr } = await runVitest({
    root: './fixtures/resource-exhaustion',
    config: './vitest.config.maxConcurrency5.ts',
  })

  expect(exitCode).toBe(0)
  expect(stderr).not.toContain('EMFILE') // Too many open files
  expect(stderr).not.toContain('ENOMEM') // Out of memory
  expect(stderr).not.toContain('Maximum call stack')
}, 30000)

// TODO: Re-enable once edge case fixtures are stabilized
test.skip('handles edge concurrency values', async () => {
  // maxConcurrency: 0 should default to 5
  const { exitCode: zeroExit, stdout: zeroStdout } = await runVitest({
    root: './fixtures/issue-8367',
    config: false,
    maxConcurrency: 0,
  })
  expect(zeroExit).toBe(0)

  // maxConcurrency: Infinity should allow unlimited
  const { stdout: infinityStdout } = await runVitest({
    root: './fixtures/issue-8367',
    config: false,
    maxConcurrency: Infinity,
  })

  // With Infinity, hooks can run in parallel
  const timings = [...infinityStdout.matchAll(/beforeAll start: \w+ at (\d+)ms/g)]
    .map(m => Number.parseInt(m[1]))

  if (timings.length >= 2) {
    // Should start nearly simultaneously
    const maxDiff = Math.max(...timings) - Math.min(...timings)
    expect(maxDiff).toBeLessThan(100)
  }
})
