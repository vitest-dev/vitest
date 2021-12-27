import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Unocss from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno } from 'unocss'

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '~/': `${resolve(__dirname, 'client')}/`,
      '@vitest/ws-client': `${resolve(__dirname, '../ws-client/src/index.ts')}`,
    },
  },
  plugins: [
    Vue(),
    Unocss({
      presets: [
        presetUno(),
        presetAttributify(),
        presetIcons(),
      ],
      shortcuts: {
        'bg-header': 'bg-gray-500:5',
        'bg-active': 'bg-gray-500:8',
        'bg-hover': 'bg-gray-500:20',
        'border-base': 'border-gray-500:10',
      },
    }),
    Components({
      dirs: ['client/components'],
      dts: resolve(__dirname, './client/components.d.ts'),
    }),
    AutoImport({
      dts: resolve(__dirname, './client/auto-imports.d.ts'),
      imports: [
        'vue',
        '@vueuse/core',
      ],
    }),
  ],
  build: {
    outDir: './dist/client',
  },
  optimizeDeps: {
    include: [
      'vue',
    ],
  },
})
