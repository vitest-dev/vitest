import { chromium } from 'playwright'
import { test as base } from 'vitest'
import { clearActiveTraceRecorder, setActiveTraceRecorder } from './active'
import { getTraceAttempt } from './attempt'
import { createTraceRecorder } from './recorder'

export { expect } from './expect'

export const test = base
  .extend('browser', { scope: 'worker' }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch()
    onCleanup(() => browser.close())
    return browser
  })
  .extend('page', async ({ browser }, { onCleanup }) => {
    const page = await browser.newPage()
    onCleanup(() => page.close())
    return page
  })
  .extend('trace', { auto: true }, async ({ page, task }, { onCleanup }) => {
    const trace = await createTraceRecorder(page, task, getTraceAttempt(task))
    setActiveTraceRecorder(trace)
    onCleanup(async () => {
      clearActiveTraceRecorder(trace)
      await trace.finish()
    })
    return trace
  })
