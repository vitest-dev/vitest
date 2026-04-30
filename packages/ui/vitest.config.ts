import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { webdriverio } from '@vitest/browser-webdriverio'
import { mergeConfig } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// known working set of tests for providers
// pnpm -C packages/ui test:ui
// PROVIDER=webdriverio pnpm -C packages/ui test:ui SmallTab
// PROVIDER=preview pnpm -C packages/ui test:ui SmallTab -t access

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
    reporters: [
      process.env.CI
        ? [
            'html',
            {
              outputFile: '.vitest/html/index.html',
              singleFile: true,
            },
          ]
        : {},
      ...configDefaults.reporters,
    ],
    browser: {
      enabled: true,
      traceView: true,
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
