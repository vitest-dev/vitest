/* eslint-disable import/no-mutable-exports */
import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { chromium } from 'playwright-chromium'
import type { Browser, Page } from 'playwright-chromium'
import { expect } from 'vitest'
import type { ExecaChildProcess } from 'execa'
import { execaCommand } from 'execa'

export let page!: Page
export let browser!: Browser
export const browserErrors: Error[] = []
export const ports = {
  ui: 9000,
  report: 9001,
}

const DIR = path.join(os.tmpdir(), 'vitest_playwright_global_setup')
export const isWindows = process.platform === 'win32'

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
  const maxTries = 300
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

export async function withLoadUrl(url: string): Promise<void> {
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

export async function startChromium() {
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
}

export async function startServerCommand(command: string, url: string) {
  let error: any
  const exitChromium = await startChromium()
  const subProcess = execaCommand(command, {
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'pipe',
  })

  subProcess.catch((e) => {
    error = e
  })

  const killSubProcess = () => killProcess(subProcess)

  subProcess.stdout?.on('data', (d) => {
    // eslint-disable-next-line no-console
    console.log(d.toString())
  })

  expect(error).not.toBeTruthy()

  async function exit() {
    try {
      await killSubProcess()
      await exitChromium()
    }
    catch (e) {
      console.error(
          `error while killing process ${command}:`,
          e,
      )
    }
  }

  try {
    await withLoadUrl(url)
    await page.goto(url)
  }
  catch (e) {
    await exit()
    throw e
  }

  return exit
}

/**
 * Poll a getter until the value it returns includes the expected value.
 */
export async function untilUpdated(
  poll: () => string | Promise<string | null> | null,
  expected: string,
): Promise<void> {
  const maxTries = process.env.CI ? 200 : 50
  for (let tries = 0; tries < maxTries; tries++) {
    const actual = (await poll()) ?? ''
    if (actual.includes(expected) || tries === maxTries - 1) {
      expect(actual).toMatch(expected)
      break
    }
    else {
      await timeout(50)
    }
  }
}
