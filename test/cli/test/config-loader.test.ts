import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const isTypeStrippingSupported = !!process.features.typescript

test.runIf(isTypeStrippingSupported)('configLoader native', async () => {
  const { stderr, exitCode } = await runVitest({
    root: 'fixtures/config-loader',
    $cliOptions: {
      configLoader: 'native',
    },
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('configLoader runner', async () => {
  const { vitest, exitCode } = await runVitest({
    root: 'fixtures/config-loader',
    $cliOptions: {
      configLoader: 'runner',
    },
  })
  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('✓ |node|')
  expect(vitest.stdout).toContain('✓ |browser (chromium)|')
  expect(exitCode).toBe(0)
})
