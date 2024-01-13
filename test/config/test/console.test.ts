import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('default intercept', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
  })
  expect(stderr).toBe('stderr | basic.test.ts > basic\n__test_console__\n\n')
})

test('disable intercept', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
    disableConsoleIntercept: true,
  })
  expect(stderr).toBe('__test_console__\n')
})
