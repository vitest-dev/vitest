import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('benchmark', async () => {
  const result = await runVitest({ root: 'fixtures/benchmark' }, [], 'benchmark')
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('✓ basic.bench.ts > suite-a')
  expect(result.exitCode).toBe(0)
})
