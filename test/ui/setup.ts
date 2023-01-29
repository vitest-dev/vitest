/* eslint-disable import/no-mutable-exports */
import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import fetch from 'node-fetch-native'
import { chromium } from 'playwright-chromium'
import type { Browser, Page } from 'playwright-chromium'
import { beforeAll } from 'vitest'
import type { ExecaChildProcess } from 'execa'

export let page!: Page
export let browser!: Browser
export const browserErrors: Error[] = []

const DIR = path.join(os.tmpdir(), 'vitest_playwright_global_setup')
export const isWindows = process.platform === 'win32'

beforeAll(async () => {
  const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf-8')
  if (!wsEndpoint)
    throw new Error('wsEndpoint not found')

  browser = await chromium.connect(wsEndpoint)
  page = await browser.newPage()

  try {
    page.on('pageerror', (error) => {
      browserErrors.push(error)
    })
  }
  catch (e) {
    await page.close()
    throw e
  }

  return async () => {
    await page?.close()
    if (browser)
      await browser.close()
  }
})

export function timeout(time: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, time)
  })
}

export async function withRetry(
  func: () => Promise<void>,
): Promise<void> {
  const maxTries = 200
  for (let tries = 0; tries < maxTries; tries++) {
    try {
      await func()
      return
    }
    catch {}
    await timeout(50)
  }
  await func()
}

export async function withLoad(url: string): Promise<void> {
  return withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok)
      throw new Error('url not loaded')
  })
}

export async function killProcess(
  serverProcess: ExecaChildProcess,
): Promise<void> {
  if (isWindows) {
    try {
      const { execaCommandSync } = await import('execa')
      execaCommandSync(`taskkill /pid ${serverProcess.pid} /T /F`)
    }
    catch (e) {
      console.error('failed to taskkill:', e)
    }
  }
  else {
    serverProcess.kill('SIGTERM', { forceKillAfterTimeout: 2000 })
  }
}
