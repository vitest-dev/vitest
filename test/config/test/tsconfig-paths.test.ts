import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('custom resolve options are preserved in vitest', async () => {
  const { stderr, exitCode } = await runVitest({
    root: 'fixtures/tsconfig-paths',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
