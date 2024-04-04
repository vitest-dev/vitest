import { expect, it } from 'vitest'
import * as pathe from 'pathe'
import { runVitest } from '../../test-utils'

it('non-tty', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/basic')
  const result = await runVitest({ root }, ['base.bench.ts'], 'benchmark')
  const lines = result.stdout.split('\n').slice(3).slice(0, 10)
  expect(lines).toMatchObject([
    ' ✓ base.bench.ts > sort',
    '     name',
    '   · normal',
    '   · reverse',
    ' ✓ base.bench.ts > timeout',
    '     name',
    '   · timeout100',
    '   · timeout75',
    '   · timeout50',
    '   · timeout25',
  ].map(s => expect.stringContaining(s)))
})
