import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(cliOptions: any, configValue: any) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { test: configValue as any })
  onTestFinished(() => vitest.close())
  return vitest
}

test('browser.screenshotTestEnd defaults to false', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  expect(config.browser.screenshotTestEnd).toBe(false)
})

test('browser.screenshotTestEnd: true works with playwright', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      screenshotTestEnd: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  expect(config.browser.screenshotTestEnd).toBe(true)
})

test('browser.screenshotTestEnd is disabled for preview provider', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
      screenshotTestEnd: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  // Should be forcefully disabled for preview provider
  expect(config.browser.screenshotTestEnd).toBe(false)
})

test('browser.cleanupScreenshots defaults to false', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  expect(config.browser.cleanupScreenshots).toBe(false)
})

test('browser.cleanupScreenshots: true works', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
      cleanupScreenshots: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  expect(config.browser.cleanupScreenshots).toBe(true)
})

test('browser.cleanupScreenshots is serialized to runtime config', async () => {
  const { config, projects } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
      cleanupScreenshots: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
  })

  // Verify it's in the resolved config
  expect(config.browser.cleanupScreenshots).toBe(true)

  // Verify it would be serialized (this tests the integration from config -> serialization)
  const project = projects[0]
  expect(project.config.browser.cleanupScreenshots).toBe(true)
})

test('browser.screenshotTestEnd works with browser.cleanupScreenshots', async () => {
  const { config } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      screenshotTestEnd: true,
      cleanupScreenshots: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
    ui: {
      enabled: true,
      screenshotsInReport: true,
    },
  })

  expect(config.browser.screenshotTestEnd).toBe(true)
  expect(config.browser.cleanupScreenshots).toBe(true)
  expect(config.ui.screenshotsInReport).toBe(true)
})
