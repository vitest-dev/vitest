import type { TestUserConfig } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe.for([
  'root',
  'project',
])('as a %s config', (type) => {
  test.for([
    { name: 'forks', pool: 'forks' },
    { name: 'threads', pool: 'threads' },
    { name: 'vmForks', pool: 'vmForks' },
    { name: 'vmThreads', pool: 'vmThreads' },
    {
      name: 'browser',
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' as const }],
      },
    },
    {
      name: 'browser-sdk',
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' as const }],
      },
    },
  ])('$name doesn\'t crash vitest', async (custom) => {
    const config: TestUserConfig = {
      ...custom,
      experimental: {
        openTelemetry: {
          enabled: true,
          sdkPath: './otel.sdk.js',
          browserSdkPath: custom.name === 'browser-sdk'
            ? './otel.browser.sdk.js'
            : undefined,
        },
      },
    }

    const { testTree, stderr } = await runVitest({
      // root needs to be set before vitest sets up,
      // but browser options need to be in the config already
      root: './fixtures/otel-tests',
      ...(type === 'root'
        ? config
        : { projects: [{ test: config }] }),
    })
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "passes": "passed",
        },
      }
    `)
  })
})
