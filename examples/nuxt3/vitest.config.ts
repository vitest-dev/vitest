import path = require('path')
import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    Vue(),
    // Enables auto-import of vue api: toRefs, computed, watch, ref, ...
    AutoImport({
      imports: ['vue'],
    }),
    // Enable auto-import of components
    Components({
      dirs: ['components'],
      directoryAsNamespace: true, // components/nested/Child.vue => <NestedChild />
      // directoryAsNamespace: false, // components/nested/NestedChild.vue => <NestedChild />
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    deps: {
      // Avoid Vitest initialization with native Node instead of Vite Node
      inline: [/@nuxt\/test-utils-edge/],
    },
  },
  root: '.',
  resolve: {
    alias: {
      // Allows imports as '~/components/nested/NestedChild.vue'
      '~': path.resolve(__dirname, '.'),
    },
  },
})
