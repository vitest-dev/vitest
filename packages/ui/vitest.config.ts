import { playwright } from '@vitest/browser-playwright'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    optimizeDeps: {
      include: ['vue-router', 'splitpanes', 'd3-graph-controller', 'vue-virtual-scroller'],
    },
    test: {
      browser: {
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
)
