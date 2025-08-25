import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const isTypeStrippingSupported = !!process.features.typescript

test('configLoader default', async () => {
  const { vitest, exitCode } = await runVitestCli(
    'run',
    '--root',
    'fixtures/config-loader',
  )
  if (!isTypeStrippingSupported) {
    expect(vitest.stderr).toContain('failed to load config')
    expect(exitCode).not.toBe(0)
  }
  else {
    expect(exitCode).toBe(0)
  }
})

test('configLoader runner', async () => {
  const { vitest, exitCode } = await runVitestCli(
    'run',
    '--root',
    'fixtures/config-loader',
    '--configLoader',
    'runner',
  )
  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('✓  node')
  expect(vitest.stdout).toContain('✓  browser (chromium)')
  expect(exitCode).toBe(0)
})
