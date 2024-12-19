import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('show code frame', async () => {
  const filename = resolve('./fixtures/code-frame-line-limit.test.ts')
  const { stderr } = await runVitest({ root: './fixtures' }, [filename])
  expect(stderr).toContain('5|   expect([{ prop: 7 },')
})
