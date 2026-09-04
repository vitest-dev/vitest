import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { mergeConfig } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// known working set of tests for providers
// pnpm -C packages/ui test:ui
// PROVIDER=preview pnpm -C packages/ui test:ui SmallTab -t access

const providerName = (process.env.PROVIDER || 'playwright') as
  | 'playwright'
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
      process.env.VITEST_CI_BLOB_LABEL
        ? ['blob', { label: process.env.VITEST_CI_BLOB_LABEL }]
        : {},
      process.env.VITEST_CI_MERGE_REPORTS
        ? ['html', { singleFile: true }]
        : {},
      ...configDefaults.reporters,
    ],
    browser: {
      enabled: true,
      traceView: true,
      headless: true,
      provider:
        providerName === 'preview'
          ? preview()
          : playwright({
              actionTimeout: 5000,
            }),
      instances: [{ browser: 'chromium' }],
    },
  },
})

export default mergeConfig(viteConfig, testConfig)
