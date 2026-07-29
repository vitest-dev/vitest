import { createRequire } from 'node:module'
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

test('correctly runs tests if custom env is an absolute path', async () => {
  const require = createRequire(import.meta.url)

  const { stderr, exitCode } = await runVitest({
    root: './fixtures/custom-file-env',
    config: false,
    environment: require.resolve('vitest-environment-custom'),
    environmentOptions: {
      custom: {
        option: 'custom-option',
      },
    },
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
