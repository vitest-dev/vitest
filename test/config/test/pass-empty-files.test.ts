import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('vitest doesnt fail when running empty files', async () => {
  const { stdout, exitCode } = await runVitest({
    root: './fixtures/pass-empty-files',
    passWithNoTests: true,
  })
  expect(stdout).toContain('No test files found, exiting with code 0')
  expect(exitCode).toBe(0)
})
