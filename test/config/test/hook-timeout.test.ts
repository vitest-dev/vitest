import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('timeout error with stack trace', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/hook-timeout',
  })
  expect(stderr).toMatchSnapshot()
})
