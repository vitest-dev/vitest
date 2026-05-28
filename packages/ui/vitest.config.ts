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
      process.env.VITEST_CI_BLOB_LABEL
        ? ['blob', { label: process.env.VITEST_CI_BLOB_LABEL }]
        : {},
      process.env.VITEST_CI_MERGE_REPORTS
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
      headless: true,
      provider:
        providerName === 'preview'
          ? preview()
          : providerName === 'webdriverio'
            ? webdriverio({
                ...(process.env.CHROMEDRIVER_PATH && process.env.CHROME_BIN
                  ? {
                      'wdio:chromedriverOptions': {
                        binary: process.env.CHROMEDRIVER_PATH,
                      },
                      'capabilities': {
                        'goog:chromeOptions': {
                          binary: process.env.CHROME_BIN,
                          // Chrome for Testing is not covered by Ubuntu's AppArmor sandbox policy on CI.
                          // https://pptr.dev/troubleshooting#issues-with-apparmor-on-ubuntu
                          // https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md
                          // https://github.com/browser-actions/setup-chrome/issues/639
                          ...(process.env.CI && process.platform === 'linux'
                            ? { args: ['no-sandbox', 'disable-dev-shm-usage'] }
                            : {}),
                        },
                      },
                    }
                  : {}),
              })
            : playwright({
                actionTimeout: 5000,
              }),
      instances: [providerName === 'webdriverio' ? { browser: 'chrome' } : { browser: 'chromium' }],
    },
  },
})

export default mergeConfig(viteConfig, testConfig)
