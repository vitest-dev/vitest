import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('benchmark', async () => {
  const result = await runVitest({ root: 'fixtures/benchmark' }, [], 'benchmark')
  expect(result.stderr).toReportNoErrors()
  // TODO 2024-12-11 check |name| when it's supported
  expect(result.stdout).toContain('✓ basic.bench.ts > suite-a')
  expect(result.exitCode).toBe(0)
})
