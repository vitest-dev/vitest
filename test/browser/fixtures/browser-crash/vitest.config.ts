import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'
import { BrowserCommand } from 'vitest/node'

const forceCrash: BrowserCommand<[]> = async (context) => {
  const browser = context.context.browser().browserType().name()
  if (browser === 'chromium') {
    await context.page.goto('chrome://crash')
  }

  if (browser === 'firefox') {
    await context.page.goto('about:crashcontent')
  }

  throw new Error(`Browser crash not supported for ${browser}`)
}

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      commands: { forceCrash },
      enabled: true,
      provider,
      instances: instances.map(instance => ({
        ...instance,
        context: {
          actionTimeout: 500,
        },
      })),
    },
    expect: {
      poll: {
        timeout: 500,
      },
    },
  },
})
