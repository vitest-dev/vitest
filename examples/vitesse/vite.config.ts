/// <reference types="vitest" />

import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    Vue(),
    AutoImport({
      dts: 'src/auto-import.d.ts',
      imports: [
        'vue',
      ],
      exclude: [
        '**/dist/**',
      ],
    }),
    Components({
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    // TODO actually, if @vue/test-utils provided "exports" field, this wouldn't be needed
    mainFields: ['module'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
