import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright',
      providerOptions: {
        launch: {
          timeout: 1234,
          // @ts-expect-error test type error
          slowMo: 'wrong',
        },
      },
      instances: [
        {
          browser: 'chromium',
          launch: {
            timeout: 1234,
            // @ts-expect-error test type error
            slowMo: 'wrong',
          },
        },
      ],
    },
  },
})
