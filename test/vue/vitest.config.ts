import { defineConfig, mergeConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import defaults from '../../vitest.config'

export default mergeConfig(
  defaults,
  defineConfig({
    plugins: [
      Vue(),
    ],
    test: {
      global: true,
      dom: 'jsdom',
    },
  }),
)
