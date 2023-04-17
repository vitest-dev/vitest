import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import type { BrowserServer } from 'playwright-chromium'
import { chromium } from 'playwright-chromium'

const DIR = path.join(os.tmpdir(), 'vitest_playwright_global_setup')

let browserServer: BrowserServer | undefined

export async function setup(): Promise<void> {
  browserServer = await chromium.launchServer()

  await fs.mkdirp(DIR)
  await fs.writeFile(path.join(DIR, 'wsEndpoint'), browserServer.wsEndpoint())
}

export async function teardown(): Promise<void> {
  await browserServer?.close()
}
