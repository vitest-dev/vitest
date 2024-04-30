import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('correctly runs tests with a "base" specified in the config', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/base-path',
  }, [], 'test', {
    base: '/some/base/url',
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
