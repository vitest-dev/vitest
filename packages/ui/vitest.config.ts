import { playwright } from '@vitest/browser/providers/playwright'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      browser: {
        name: 'chromium',
        provider: playwright(),
      },
    },
  }),
)
