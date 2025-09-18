import { readdirSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { provider, runBrowserTests } from './utils'

describe.runIf(provider.name === 'playwright')('playwright tracing', () => {
  test('vitest generates trace files when running with `on`', async () => {
    const { stderr } = await runBrowserTests({
      root: './fixtures/trace-view',
      browser: {
        trace: 'on',
      },
    })
    const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-view/__traces__')
    const testTracesFolder = resolve(tracesFolder, 'basic.test.ts')
    onTestFinished(() => rmSync(tracesFolder, { recursive: true, force: true }))

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(testTracesFolder).sort()).toMatchInlineSnapshot(`
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
  })

  test('vitest generates trace files when running with `on-all-retries`', async () => {
    const { stderr } = await runBrowserTests({
      root: './fixtures/trace-view',
      browser: {
        trace: 'on-all-retries',
      },
    })
    const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-view/__traces__')
    const testTracesFolder = resolve(tracesFolder, 'basic.test.ts')
    onTestFinished(() => rmSync(tracesFolder, { recursive: true, force: true }))

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(testTracesFolder).sort()).toMatchInlineSnapshot(`
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
    const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-view/__traces__')
    const testTracesFolder = resolve(tracesFolder, 'basic.test.ts')
    onTestFinished(() => rmSync(tracesFolder, { recursive: true, force: true }))

    expect(stderr).toBe('')
    expect(readdirSync(tracesFolder)).toEqual(['basic.test.ts'])
    expect(readdirSync(testTracesFolder).sort()).toMatchInlineSnapshot(`
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
    await runBrowserTests({
      root: './fixtures/trace-view',
      include: ['./*.test.ts', './*.special.ts'],
      browser: {
        trace: 'retain-on-failure',
      },
    })

    const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-view/__traces__')
    const basicTestTracesFolder = resolve(tracesFolder, 'basic.test.ts')
    const failingTestTracesFolder = resolve(tracesFolder, 'failing.special.ts')
    onTestFinished(() => rmSync(tracesFolder, { recursive: true, force: true }))

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
  })
})
