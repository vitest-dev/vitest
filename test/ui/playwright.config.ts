import type { ReporterDescription } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

const reporter: ReporterDescription[] = [[process.env.CI ? 'dot' : 'list']]
if (process.env.VITEST_CI_FLAKINESS) {
  reporter.push(['@flakiness/playwright', { flakinessProject: 'vitest/vitest' }])
}

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    trace: process.env.CI ? 'on-first-retry' : undefined,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter,
})
