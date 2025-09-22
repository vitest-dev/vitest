import { readdirSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { afterEach, describe, expect, test } from 'vitest'
import { provider, runBrowserTests } from './utils'

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
          expect(annotation.message).toContain('basic.test.ts/')
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

    expect(readdirSync(tracesFolder)).toEqual([
      'basic.test.ts',
      'failing.special.ts',
    ])
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
    expect(stderr).toContain('↳ __traces__/failing.special.ts/')
  })
})
