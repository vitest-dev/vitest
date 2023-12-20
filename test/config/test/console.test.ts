import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('default intercept', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
  })
  expect(stderr).toContain('stderr | basic.test.ts > basic\n__test_console__')
})

test('raw', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
    spyConsoleLog: false,
  })
  expect(stderr).toContain('__test_console__')
})
