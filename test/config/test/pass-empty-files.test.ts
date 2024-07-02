import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('vitest doesnt fail when running empty files', async () => {
  const { exitCode } = await runVitest({
    root: './fixtures/pass-empty-files',
    passWithNoTests: true,
  })
  expect(exitCode).toBe(0)
})
