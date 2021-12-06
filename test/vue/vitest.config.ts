import { defineConfig, mergeConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import defaults from '../../vitest.config'

export default mergeConfig(
  defaults,
  defineConfig({
    optimizeDeps: {
      include: ['vue', '@vue/test-utils'],
    },
    plugins: [
      Vue(),
    ],
    test: {
      global: true,
      jsdom: true,
      deps: {
        inline: [
          'vue',
          '@vue',
        ],
      },
    },
  }),
)
