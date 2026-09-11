import type { BrowserCommand } from 'vitest/node'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// rejects after the timeout the action derived plus the delay encoded in the
// file name, so the action reports back either inside or past the task's grace
const slowScreenshot: BrowserCommand<[name: string, options: { timeout: number }]> = (_context, name, options) => {
  const delay = Number(/delay-(\d+)/.exec(name)?.[1] ?? 0)
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`slow screenshot after ${delay}ms`)), options.timeout + delay)
    timer.unref?.()
  })
}

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      screenshotFailures: false,
      commands: {
        __vitest_screenshot: slowScreenshot,
      },
    },
  },
})
