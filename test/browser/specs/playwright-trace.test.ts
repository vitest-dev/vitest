import { existsSync, readdirSync, rmSync } from 'node:fs'
import { basename, resolve } from 'pathe'
import { chromium } from 'playwright'
import { afterEach, describe, expect, test } from 'vitest'
import { useTmpFS } from '../../test-utils'
import { providers } from '../settings'
import { instances, provider, runBrowserTests, runInlineBrowserTests } from './utils'

const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-view/__traces__')
const basicTestTracesFolder = resolve(tracesFolder, 'basic.test.ts')

describe.runIf(provider.name === 'playwright')('playwright tracing', () => {
  afterEach(() => {
    rmSync(tracesFolder, { recursive: true, force: true })
  })

  test('vitest generates trace files when running with `on`', async () => {
    const { stderr, ctx } = await runBrowserTests({
      root: './fixtures/trace-view',
      browser: {
        trace: 'on',
      },
      includeTaskLocation: true,
    })

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(basicTestTracesFolder).sort()).toMatchInlineSnapshot(`
    [
      "chromium-a-single-test-0-0.trace.zip",
      "chromium-nested-suite-suite-test-0-0.trace.zip",
      "chromium-repeated-retried-tests-0-0.trace.zip",
      "chromium-repeated-retried-tests-0-1.trace.zip",
      "chromium-repeated-retried-tests-0-2.trace.zip",
      "chromium-repeated-retried-tests-1-0.trace.zip",
      "chromium-repeated-retried-tests-2-0.trace.zip",
      "chromium-repeated-test-0-0.trace.zip",
      "chromium-repeated-test-1-0.trace.zip",
      "chromium-repeated-test-2-0.trace.zip",
      "chromium-retried-test-0-0.trace.zip",
      "chromium-retried-test-0-1.trace.zip",
      "chromium-retried-test-0-2.trace.zip",
      "firefox-a-single-test-0-0.trace.zip",
      "firefox-nested-suite-suite-test-0-0.trace.zip",
      "firefox-repeated-retried-tests-0-0.trace.zip",
      "firefox-repeated-retried-tests-0-1.trace.zip",
      "firefox-repeated-retried-tests-0-2.trace.zip",
      "firefox-repeated-retried-tests-1-0.trace.zip",
      "firefox-repeated-retried-tests-2-0.trace.zip",
      "firefox-repeated-test-0-0.trace.zip",
      "firefox-repeated-test-1-0.trace.zip",
      "firefox-repeated-test-2-0.trace.zip",
      "firefox-retried-test-0-0.trace.zip",
      "firefox-retried-test-0-1.trace.zip",
      "firefox-retried-test-0-2.trace.zip",
      "webkit-a-single-test-0-0.trace.zip",
      "webkit-nested-suite-suite-test-0-0.trace.zip",
      "webkit-repeated-retried-tests-0-0.trace.zip",
      "webkit-repeated-retried-tests-0-1.trace.zip",
      "webkit-repeated-retried-tests-0-2.trace.zip",
      "webkit-repeated-retried-tests-1-0.trace.zip",
      "webkit-repeated-retried-tests-2-0.trace.zip",
      "webkit-repeated-test-0-0.trace.zip",
      "webkit-repeated-test-1-0.trace.zip",
      "webkit-repeated-test-2-0.trace.zip",
      "webkit-retried-test-0-0.trace.zip",
      "webkit-retried-test-0-1.trace.zip",
      "webkit-retried-test-0-2.trace.zip",
    ]
  `)

    // traces are also stored in attachments so they are visible in all reporters
    const testModules = ctx.state.getTestModules()
    expect(testModules).toHaveLength(3)
    testModules.forEach((testModule) => {
      for (const test of testModule.children.allTests()) {
        if (test.result().state === 'skipped') {
          continue
        }

        const annotations = test.annotations()
        expect(annotations.length).toBeGreaterThan(0)

        annotations.forEach((annotation) => {
          expect(annotation.message).toMatch(/^(chromium|firefox|webkit)-[\w-]+-\d+-\d+$/)
          expect(annotation.attachment!.path).toMatch(
            new RegExp(`/\\.vitest/attachments/${annotation.message}-[\\da-f]{40}\\.zip$`),
          )
          expect(annotation.type).toBe('traces')
          expect(annotation.attachment!.contentType).toBe('application/octet-stream')
          expect(annotation.location).toEqual({
            file: test.module.moduleId,
            line: test.location.line,
            column: test.location.column,
          })
        })
      }
    })
  })

  test('vitest generates trace files when running with `on-all-retries`', async () => {
    const { stderr } = await runBrowserTests({
      root: './fixtures/trace-view',
      browser: {
        trace: 'on-all-retries',
      },
    })

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(basicTestTracesFolder).sort()).toMatchInlineSnapshot(`
    [
      "chromium-repeated-retried-tests-0-1.trace.zip",
      "chromium-repeated-retried-tests-0-2.trace.zip",
      "chromium-retried-test-0-1.trace.zip",
      "chromium-retried-test-0-2.trace.zip",
      "firefox-repeated-retried-tests-0-1.trace.zip",
      "firefox-repeated-retried-tests-0-2.trace.zip",
      "firefox-retried-test-0-1.trace.zip",
      "firefox-retried-test-0-2.trace.zip",
      "webkit-repeated-retried-tests-0-1.trace.zip",
      "webkit-repeated-retried-tests-0-2.trace.zip",
      "webkit-retried-test-0-1.trace.zip",
      "webkit-retried-test-0-2.trace.zip",
    ]
  `)
  })

  test('vitest generates trace files when running with `on-first-retries`', async () => {
    const { stderr } = await runBrowserTests({
      root: './fixtures/trace-view',
      browser: {
        trace: 'on-first-retry',
      },
    })

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(basicTestTracesFolder).sort()).toMatchInlineSnapshot(`
    [
      "chromium-repeated-retried-tests-0-1.trace.zip",
      "chromium-retried-test-0-1.trace.zip",
      "firefox-repeated-retried-tests-0-1.trace.zip",
      "firefox-retried-test-0-1.trace.zip",
      "webkit-repeated-retried-tests-0-1.trace.zip",
      "webkit-retried-test-0-1.trace.zip",
    ]
  `)
  })

  test('vitest generates trace files when running with `retain-on-failure`', async () => {
    const { stderr } = await runBrowserTests({
      root: './fixtures/trace-view',
      include: ['./*.test.ts', './*.special.ts'],
      browser: {
        trace: 'retain-on-failure',
      },
    })

    const failingTestTracesFolder = resolve(tracesFolder, 'failing.special.ts')

    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts', 'failing.special.ts'])
    expect(readdirSync(basicTestTracesFolder).sort()).toMatchInlineSnapshot(`[]`)
    expect(readdirSync(failingTestTracesFolder).sort()).toMatchInlineSnapshot(`
    [
      "chromium-fail-0-0.trace.zip",
      "chromium-repeated-fail-0-0.trace.zip",
      "chromium-repeated-fail-1-0.trace.zip",
      "chromium-repeated-fail-2-0.trace.zip",
      "chromium-retried-fail-0-0.trace.zip",
      "chromium-retried-fail-0-1.trace.zip",
      "chromium-retried-fail-0-2.trace.zip",
      "firefox-fail-0-0.trace.zip",
      "firefox-repeated-fail-0-0.trace.zip",
      "firefox-repeated-fail-1-0.trace.zip",
      "firefox-repeated-fail-2-0.trace.zip",
      "firefox-retried-fail-0-0.trace.zip",
      "firefox-retried-fail-0-1.trace.zip",
      "firefox-retried-fail-0-2.trace.zip",
      "webkit-fail-0-0.trace.zip",
      "webkit-repeated-fail-0-0.trace.zip",
      "webkit-repeated-fail-1-0.trace.zip",
      "webkit-repeated-fail-2-0.trace.zip",
      "webkit-retried-fail-0-0.trace.zip",
      "webkit-retried-fail-0-1.trace.zip",
      "webkit-retried-fail-0-2.trace.zip",
    ]
  `)

    // the default reporter outputs attachments
    expect(stderr).toContain('❯ traces')
    expect(stderr).toContain('↳ chromium-fail-0-0')
  })

  // the whole path is limited to 260 characters on Windows unless long paths are enabled
  describe.skipIf(process.platform === 'win32')('long test names', () => {
    test.for([
      { name: 'default traces folder', trace: 'on', folder: '__traces__/long.test.ts' },
      {
        name: 'custom tracesDir',
        trace: { mode: 'on', tracesDir: './playwright-traces' },
        folder: 'playwright-traces',
      },
    ] as const)(
      'trace file names fit into the file system limit ($name)',
      async ({ trace, folder }) => {
        const browser = instances[0].browser
        const name = 'a test with a very long name '.repeat(10).trim()
        const { ctx, stderr, root } = await runInlineBrowserTests(
          {
            'long.test.ts': `
              import { test } from 'vitest'

              test(${JSON.stringify(name)}, { retry: 1 }, ({ task }) => {
                if (task.result?.retryCount !== 1) {
                  throw new Error('failed test')
                }
              })
            `,
          },
          {
            browser: {
              instances: [instances[0]],
              trace,
              // failure screenshots have the same problem with long names, see #11455
              screenshotFailures: false,
            },
          },
        )

        expect(stderr).toBe('')

        const traces = readdirSync(resolve(root, folder))
          .filter((file) => file.endsWith('.trace.zip'))
          .sort()
        expect(traces.map((file) => file.slice(-14))).toEqual(['-0-0.trace.zip', '-0-1.trace.zip'])
        traces.forEach((file) => {
          expect(Buffer.byteLength(file)).toBeLessThanOrEqual(255)
          expect(file).toMatch(
            new RegExp(
              `^${browser}-a-test-with-a-very-long-name-.*~[\\da-f]{16}-0-\\d\\.trace\\.zip$`,
            ),
          )
        })

        const [testModule] = ctx!.state.getTestModules()
        const [testCase] = Array.from(testModule.children.allTests())
        const annotations = testCase.annotations()
        expect(annotations).toHaveLength(2)
        annotations.forEach((annotation) => {
          expect(annotation.type).toBe('traces')
          const attachment = basename(annotation.attachment!.path!)
          expect(Buffer.byteLength(attachment)).toBeLessThanOrEqual(255)
          expect(attachment).toMatch(
            new RegExp(`^${annotation.message.replace('~', '-')}-[\\da-f]{40}\\.zip$`),
          )
          expect(existsSync(annotation.attachment!.path!)).toBe(true)
        })
        expect(annotations.map((annotation) => `${annotation.message}.trace.zip`).sort()).toEqual(
          traces,
        )
      },
    )
  })

  test('consecutive dashes in test names are not collapsed', async () => {
    const { stderr, root } = await runInlineBrowserTests(
      {
        'basic.test.ts': `
          import { test } from 'vitest'

          test('foo bar', () => {})
          test('foo: bar', () => {})
        `,
      },
      { browser: { instances: [instances[0]], trace: 'on' } },
    )

    expect(stderr).toBe('')
    expect(readdirSync(resolve(root, '__traces__/basic.test.ts')).sort()).toEqual([
      `${instances[0].browser}-foo--bar-0-0.trace.zip`,
      `${instances[0].browser}-foo-bar-0-0.trace.zip`,
    ])
  })

  // the remote archive must have a different name from the final trace
  test.runIf(instances[0].browser === 'chromium')(
    'traces are saved when the browser runs on a remote server with the same tracesDir',
    async () => {
      const fs = useTmpFS({
        'basic.test.ts': `
          import { test } from 'vitest'

          test('remote test', () => {
            // ...
          })
        `,
      })
      const tracesDir = resolve(fs.root, 'playwright-traces')
      const server = await chromium.launchServer({ headless: true, tracesDir })
      try {
        const { ctx, stderr } = await runBrowserTests({
          root: fs.root,
          browser: {
            enabled: true,
            provider: providers.playwright({
              connectOptions: { wsEndpoint: server.wsEndpoint() },
            }),
            instances: [{ browser: 'chromium' }],
            trace: { mode: 'on', tracesDir: './playwright-traces' },
          },
        })

        expect(stderr).toBe('')
        expect(readdirSync(tracesDir).filter((file) => file.endsWith('.trace.zip'))).toEqual([
          'chromium-remote-test-0-0.trace.zip',
        ])

        const [testModule] = ctx.state.getTestModules()
        const [testCase] = Array.from(testModule.children.allTests())
        const [annotation] = testCase.annotations()
        expect(annotation.message).toBe('chromium-remote-test-0-0')
        expect(existsSync(annotation.attachment!.path!)).toBe(true)
      } finally {
        await server.close()
      }
    },
  )
})
