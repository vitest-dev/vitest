import { playwright } from '@vitest/browser-playwright'
import { test } from 'vitest'
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
  ])('$name doesn\'t crash vitest', async (custom) => {
    const config = {
      ...custom,
      experimental: {
        openTelemetry: {
          enabled: true,
          sdkPath: './otel.sdk.js',
        },
      },
    }

    const { testTree, stderr } = await runVitest({
      // root needs to be set before vitest sets up,
      // but browser options need to be in the config already
      root: './fixtures/otel-tests',
    }, [], 'test', {
      test: (type === 'root'
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

test('supports TRACEPARENT environment variable', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/otel-tests',
    env: {
      TRACEPARENT: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    },
  }, [], 'test', {
    test: {
      pool: 'forks',
      experimental: {
        openTelemetry: {
          enabled: true,
          sdkPath: './otel.sdk.js',
        },
      },
    },
  })
  
  expect(exitCode).toBe(0)
  expect(stderr).toBe('')
})

test('supports TRACESTATE environment variable', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/otel-tests',
    env: {
      TRACEPARENT: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      TRACESTATE: 'vendor1=value1,vendor2=value2',
    },
  }, [], 'test', {
    test: {
      pool: 'forks',
      experimental: {
        openTelemetry: {
          enabled: true,
          sdkPath: './otel.sdk.js',
        },
      },
    },
  })
  
  expect(exitCode).toBe(0)
  expect(stderr).toBe('')
})
