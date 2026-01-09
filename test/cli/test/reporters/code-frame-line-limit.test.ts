import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('show code frame', async () => {
  const filename = resolve('./fixtures/reporters/code-frame-line-limit.test.ts')
  const { stderr } = await runVitest({ root: './fixtures/reporters' }, [filename])
  expect(stderr).toContain('5|   expect([{ prop: 7 },')
})
