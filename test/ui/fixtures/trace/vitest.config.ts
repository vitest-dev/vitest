import type { BrowserCommand } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// mousedown through custom command
// https://github.com/vitest-dev/vitest/issues/8190
const mousedownCommand: BrowserCommand<[selector: string]> = async (ctx, selector) => {
  await ctx.iframe.locator(selector).hover()
  await ctx.page.mouse.down()
}

export default defineConfig({
  test: {
    ui: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
      headless: true,
      ui: false,
      traceView: {
        enabled: true,
        // enabled only on html reporter e2e
        // inlineImages: true,
      },
      screenshotFailures: false,
      commands: {
        mousedown: mousedownCommand,
      },
    },
  },
})
