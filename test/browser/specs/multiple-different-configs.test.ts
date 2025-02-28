import { expect, test } from 'vitest'
import { provider } from '../settings'
import { runBrowserTests } from './utils'

test.runIf(provider === 'playwright')('[playwright] runs multiple different configurations correctly', async () => {
  const { stdout, exitCode, stderr } = await runBrowserTests({
    root: './fixtures/multiple-different-configs',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('[chromium] HTML_INJECTED_VAR is true')
  expect(stdout).toContain('[firefox] HTML_INJECTED_VAR is undefined')
})

test.runIf(provider === 'webdriverio')('[webdriverio] runs multiple different configurations correctly', async () => {
  const { stdout, exitCode, stderr } = await runBrowserTests({
    root: './fixtures/multiple-different-configs',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('[chromium] HTML_INJECTED_VAR is true')
  expect(stdout).toContain('[firefox] HTML_INJECTED_VAR is undefined')
})
