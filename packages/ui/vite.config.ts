import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'pathe'
import { presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import Pages from 'vite-plugin-pages'

// for debug:
// open a static file serve to share the report json
// and ui using the link to load the report json data
// const debugLink = 'http://127.0.0.1:4173/__vitest__'

export const config: UserConfig = {
  root: __dirname,
  base: './',
  resolve: {
    dedupe: ['vue'],
    alias: {
      '~/': `${resolve(__dirname, 'client')}/`,
      '@vitest/ws-client': `${resolve(__dirname, '../ws-client/src/index.ts')}`,
    },
  },
  define: {
    __BASE_PATH__: '"/__vitest__/"',
  },
  plugins: [
    Vue({
      features: {
        propsDestructure: true,
      },
      script: {
        defineModel: true,
      },
    }),
    Unocss({
      presets: [presetUno(), presetAttributify(), presetIcons()],
      shortcuts: {
        'bg-base': 'bg-white dark:bg-[#111]',
        'bg-overlay': 'bg-[#eee]:50 dark:bg-[#222]:50',
        'bg-header': 'bg-gray-500:5',
        'bg-active': 'bg-gray-500:8',
        'bg-hover': 'bg-gray-500:20',
        'border-base': 'border-gray-500:10',
        'focus-base': 'border-gray-500 dark:border-gray-400',
        'highlight': 'bg-[#eab306] text-[#323238] dark:bg-[#323238] dark:text-[#eab306]',

        'tab-button': 'font-light op50 hover:op80 h-full px-4',
        'tab-button-active': 'op100 bg-gray-500:10',
      },
      transformers: [
        transformerDirectives(),
      ],
      safelist: 'absolute origin-top mt-[8px]'.split(' '),
    }),
    Components({
      dirs: ['client/components'],
      dts: resolve(__dirname, './client/components.d.ts'),
    }),
    Pages({
      dirs: ['client/pages'],
    }),
    AutoImport({
      dts: resolve(__dirname, './client/auto-imports.d.ts'),
      dirs: ['./client/composables'],
      imports: ['vue', 'vue-router', '@vueuse/core'],
      injectAtEnd: true,
      exclude: [
        /node_modules/,
        /dist/,
        /\.git/,
      ],
    }),
    // {
    //   name: 'debug-html-report',
    //   apply: 'serve',
    //   transformIndexHtml(html) {
    //     return html.replace('<!-- !LOAD_METADATA! -->', `<script>window.METADATA_PATH="${debugLink}/html.meta.json.gz"</script>`)
    //   },
    // },
    {
      // workaround `crossorigin` issues on some browsers
      // https://github.com/vitejs/vite/issues/6648
      name: 'no-crossorigin-for-same-assets',
      apply: 'build',
      transformIndexHtml(html) {
        return html
          .replace('crossorigin src="./assets/', 'src="./assets/')
          .replace('crossorigin href="./assets/', 'href="./assets/')
      },
    },
  ],
  build: {
    outDir: './dist/client',
  },
  test: {
    browser: {
      name: 'chromium',
      provider: 'playwright',
    },
  },
}

export default defineConfig(config)
