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
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
