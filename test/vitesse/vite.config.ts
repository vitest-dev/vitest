import { defineConfig, mergeConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import defaults from '../../vitest.config'

export default mergeConfig(
  defaults,
  defineConfig({
    plugins: [
      Vue(),
      AutoImport({
        dts: 'src/auto-import.d.ts',
        imports: [
          'vue',
        ],
      }),
      Components({
        dts: 'src/components.d.ts',
      }),
    ],
    test: {
      global: true,
      jsdom: true,
    },
  }),
)
