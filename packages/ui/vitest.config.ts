import { playwright } from '@vitest/browser-playwright'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      browser: {
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
)
