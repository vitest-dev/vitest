import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      // increase viewport height so virtual scroller renders all explorer items
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  use: {
    trace: process.env.CI ? 'on-first-retry' : 'on',
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
})
