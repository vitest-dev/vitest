import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const IS_PLAYWRIGHT = process.env.PROVIDER === 'playwright'

test('benchmark', async () => {
  const result = await runVitest({ root: 'fixtures/benchmark' }, [], 'benchmark')
  expect(result.stderr).toReportNoErrors()

  if (IS_PLAYWRIGHT) {
    expect(result.stdout).toContain('✓ |chromium| basic.bench.ts > suite-a')
    expect(result.stdout).toContain('✓ |firefox| basic.bench.ts > suite-a')
    expect(result.stdout).toContain('✓ |webkit| basic.bench.ts > suite-a')
  }
  else {
    expect(result.stdout).toContain('✓ |chrome| basic.bench.ts > suite-a')
    expect(result.stdout).toContain('✓ |firefox| basic.bench.ts > suite-a')
  }

  expect(result.exitCode).toBe(0)
})
