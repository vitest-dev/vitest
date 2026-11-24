import { describe, expect, it } from 'vitest'
import { createVitest, rolldownVersion } from 'vitest/node'
import { preview } from '../../../packages/browser-preview/dist/index.js'

describe('browser instance headless config', () => {
  it('disables browser.ui when an instance enables headless and browser.ui was not explicitly set', async (ctx) => {
    ctx.skip(!!rolldownVersion && ctx.task.file.projectName === 'vmThreads')
    const vitest = await createVitest(
      'test',
      {
        config: false,
        watch: false,
      },
      {
        test: {
          ui: true,
          browser: {
            enabled: true,
            provider: preview(),
            instances: [{ browser: 'chromium', headless: true }],
          },
        },
      },
    )

    try {
      const browserProject = vitest.projects.find((p) => p.config.browser.enabled)
      expect(browserProject).toBeDefined()
      expect(browserProject!.config.browser.headless).toBe(true)
      expect(browserProject!.config.browser.ui).toBe(false)
    } finally {
      await vitest.close()
    }
  })
})
