import { runInlineTests } from '#test-utils'
import { expect, it } from 'vitest'

it('vitest doesnt fail when running empty files', async () => {
  const { exitCode } = await runInlineTests(
    { 'empty.test.js': '' },
    { passWithNoTests: true },
  )
  expect(exitCode).toBe(0)
})
