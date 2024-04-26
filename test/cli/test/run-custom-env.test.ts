import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('correctly runs tests if custom env is a file', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/custom-file-env',
    config: false,
    environment: '../../custom.ts',
    environmentOptions: {
      custom: {
        option: 'custom-option',
      },
    },
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
