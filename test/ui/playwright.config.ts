import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
  use: {
    trace: process.env.CI ? 'on-first-retry' : 'on',
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
})
