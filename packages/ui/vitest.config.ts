import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { webdriverio } from '@vitest/browser-webdriverio'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// only playwright works so far
const providerName = (process.env.PROVIDER || 'playwright') as
  | 'playwright'
  | 'webdriverio'
  | 'preview'

const testConfig = defineConfig({
  optimizeDeps: {
    include: [
      'vue-router',
      'splitpanes',
      'd3-graph-controller',
      'vue-virtual-scroller',
      'rrweb-snapshot',
    ],
  },
  test: {
    browser: {
      enabled: true,
      traceView: true,
      headless: providerName !== 'preview',
      provider:
        providerName === 'preview'
          ? preview()
          : providerName === 'webdriverio'
            ? webdriverio()
            : playwright({
                actionTimeout: 5000,
              }),
      instances: [providerName === 'webdriverio' ? { browser: 'chrome' } : { browser: 'chromium' }],
    },
  },
})

export default mergeConfig(viteConfig, testConfig)
