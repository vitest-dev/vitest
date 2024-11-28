import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('vitest doesnt fail when running empty files {passWithNoTests: true}', async () => {
  const { exitCode, stdout } = await runVitest({
    root: './fixtures/pass-empty-files',
    passWithNoTests: true,
  })
  expect(exitCode).toBe(0)
  expect(stdout).toMatch('no tests')
})

it('vitest fails when running empty files {passWithNoTests: false}', async () => {
  const { exitCode, stderr } = await runVitest({
    root: './fixtures/pass-empty-files',
    passWithNoTests: false,
  })

  expect(exitCode).toBe(1)
  expect(stderr).toMatch('Error: No test suite found in file')
})
