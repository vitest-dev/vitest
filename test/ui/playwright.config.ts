import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      // Keep enough rows rendered for tests that access the explorer without filtering.
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 1300 } },
    },
  ],
  use: {
    trace: process.env.CI ? 'on-first-retry' : undefined,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
})
