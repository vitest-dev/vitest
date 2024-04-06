import { expect, it } from 'vitest'
import * as pathe from 'pathe'
import { runVitest } from '../../test-utils'

it('summary', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/reporter')
  const result = await runVitest({ root }, ['summary.bench.ts'], 'benchmark')
  expect(result.stdout).not.toContain('NaNx')
  expect(result.stdout.split('BENCH  Summary')[1].replaceAll(/[0-9.]+x/g, '(?)')).toMatchSnapshot()
})
