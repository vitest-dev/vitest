import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
})
