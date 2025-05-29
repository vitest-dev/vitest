import { chromium } from 'playwright'
import { expect, test } from 'vitest'
import { provider } from '../settings'
import { runBrowserTests } from './utils'

test.runIf(provider === 'playwright')('[playwright] runs in connect mode', async () => {
  const browserServer = await chromium.launchServer()
  const wsEndpoint = browserServer.wsEndpoint()

  const { stdout, exitCode, stderr } = await runBrowserTests({
    root: './fixtures/playwright-connect',
    browser: {
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
          connect: {
            wsEndpoint,
          },
        },
      ],
    },
  })

  await browserServer.close()

  expect(stdout).toContain('Tests  2 passed')
  expect(exitCode).toBe(0)
  expect(stderr).toBe('')
})

test.runIf(provider === 'playwright')('[playwright] warns if both connect and launch mode are configured', async () => {
  const browserServer = await chromium.launchServer()
  const wsEndpoint = browserServer.wsEndpoint()

  const { stdout, exitCode, stderr } = await runBrowserTests({
    root: './fixtures/playwright-connect',
    browser: {
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
          connect: {
            wsEndpoint,
          },
          launch: {},
        },
      ],
    },
  })

  await browserServer.close()

  expect(stdout).toContain('Tests  2 passed')
  expect(exitCode).toBe(0)
  expect(stderr).toContain('Found both connect and launch options in browser instance configuration.')
})
