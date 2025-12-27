import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'
import { BrowserCommand } from 'vitest/node'

const forceCrash: BrowserCommand<[]> = async (context) => {
  if (context.provider.name === 'playwright') {
    const browser = context.context.browser().browserType().name()
    if (browser === 'chromium') {
      await context.page.goto('chrome://crash')
    }

    if (browser === 'firefox') {
      await context.page.goto('about:crashcontent')
    }

    throw new Error(`Browser crash not supported for ${browser}`)
  }
  if (context.provider.name === 'webdriverio') {
    const browser = context.browser
    const name = context.project.config.browser.name
    if (name === 'chrome') {
      await browser.url('chrome://crash')
    }
    if (name === 'firefox') {
      await browser.url('about:crashcontent')
    }
    throw new Error(`Browser crash not supported for ${name}`)
  }
}

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      commands: { forceCrash },
      enabled: true,
      provider,
      instances: instances.filter(i => i.browser !== 'webkit').map(instance => ({
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
