import { chromium } from 'playwright'
import { inject, test as base } from 'vitest'
import { getTraceAttempt } from './attempt'
import { createTraceRecorder } from './recorder'

export const test = base
  .extend('browser', { scope: 'worker' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('page', async ({ browser }, { onCleanup }) => {
    const page = await browser.newPage()
    onCleanup(() => page.close())
    await page.goto(inject('traceAppUrl'))
    return page
  })
  .extend('trace', { auto: true }, async ({ page, task }, { onCleanup }) => {
    const trace = await createTraceRecorder(page, task, getTraceAttempt(task))
    onCleanup(() => trace.finish())
    return trace
  })
