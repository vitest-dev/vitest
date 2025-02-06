import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('unhandled rejections of main thread are reported even when no reporter is used', async () => {
  const { stderr, exitCode } = await runVitest({
    root: 'fixtures/unhandled-rejections',
    globalSetup: ['setup-unhandled-rejections.ts'],
    reporters: [{ onInit: () => {} }],
  })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Unhandled Rejection')
  expect(stderr).toContain('Error: intentional unhandled rejection')
  expect(stderr).toContain('setup-unhandled-rejections.ts:2:42')
})
