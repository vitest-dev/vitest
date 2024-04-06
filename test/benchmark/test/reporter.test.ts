import { expect, it } from 'vitest'
import * as pathe from 'pathe'
import { runVitest } from '../../test-utils'

it('summary', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/reporter')
  const result = await runVitest({ root }, ['summary.bench.ts'], 'benchmark')
  expect(result.stdout).not.toContain('NaNx')
  expect(result.stdout.split('BENCH  Summary')[1].replaceAll(/\d/g, '?')).toMatchSnapshot()
})

it('non-tty', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/basic')
  const result = await runVitest({ root }, ['base.bench.ts'], 'benchmark')
  const lines = result.stdout.split('\n').slice(3).slice(0, 10)
  const expected = `\
 ✓ base.bench.ts > sort
     name
   · normal
   · reverse
 ✓ base.bench.ts > timeout
     name
   · timeout100
   · timeout75
   · timeout50
   · timeout25
`
  expect(lines).toMatchObject(expected.trim().split('\n').map(s => expect.stringContaining(s)))
})
