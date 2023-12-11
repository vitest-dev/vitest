import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
})
