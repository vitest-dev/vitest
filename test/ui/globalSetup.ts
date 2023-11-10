import os from 'node:os'
import path from 'node:path'
import { existsSync, promises as fsp } from 'node:fs'
import type { BrowserServer } from 'playwright-chromium'
import { chromium } from 'playwright-chromium'

const DIR = path.join(os.tmpdir(), 'vitest_playwright_global_setup')

let browserServer: BrowserServer | undefined

export async function setup(): Promise<void> {
  browserServer = await chromium.launchServer()

  if (!existsSync(DIR))
    await fsp.mkdir(DIR, { recursive: true })
  await fsp.writeFile(path.join(DIR, 'wsEndpoint'), browserServer.wsEndpoint())
}

export async function teardown(): Promise<void> {
  await browserServer?.close()
}
