import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

let config = defineConfig({
  define: {
    'process.env.TEST_PROCESS_ENV': JSON.stringify('PROCESS_OK'),
    'import.meta.env.TEST_META_ENV': JSON.stringify('META_OK'),
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
})

if (process.env.BROWSER_DEFINE_TEST_PROEJCT === "true") {
  config = defineConfig({
    test: {
      projects: [config],
    },
  })
}

export default config
