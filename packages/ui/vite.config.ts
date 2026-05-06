import assert from 'node:assert'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'pathe'
import { presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'
import Pages from 'vite-plugin-pages'

// for debug:
// open a static file serve to share the report json
// and ui using the link to load the report json data
// const debugLink = 'http://127.0.0.1:4173/__vitest__'

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  resolve: {
    dedupe: ['vue'],
    alias: {
      '~/': `${resolve(import.meta.dirname, 'client')}/`,
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
      presets: [presetUno(), presetAttributify(), presetIcons()] as any,
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
        transformerDirectives() as any,
      ],
      safelist: 'absolute origin-top mt-[8px]'.split(' '),
    }),
    Pages({
      dirs: ['client/pages'],
    }),
    // uncomment to see the HTML reporter preview
    // {
    //   name: 'debug-html-report',
    //   apply: 'serve',
    //   transformIndexHtml(html) {
    //     return html.replace('<!-- !LOAD_METADATA! -->', `<script>window.METADATA_PATH="${debugLink}/html.meta.json.gz"</script>`)
    //   },
    // },

    {
      name: 'proxy-api-token',
      apply: 'serve',
      async transformIndexHtml() {
        const apiOrigin = `http://localhost:${process.env.VITE_PORT || '51204'}`
        const apiTokenPattern = /<script>(window\.VITEST_API_TOKEN = .+?)<\/script>/s
        const response = await fetch(new URL('/__vitest__/', apiOrigin))
        assert(response.ok, `Failed to fetch VITEST_API_TOKEN from ${apiOrigin}/__vitest__/`)
        const testHtml = await response.text()
        const tokenScript = testHtml.match(apiTokenPattern)?.[1]
        assert(tokenScript, 'Failed to extract VITEST_API_TOKEN from the response')
        return [
          {
            tag: 'script',
            children: tokenScript,
            injectTo: 'head-prepend',
          },
        ]
      },
    },

    // TODO
    // uncomment to see the browser tab
    !!process.env.BROWSER_DEV_PREVIEW && {
      name: 'browser-dev-preview',
      apply: 'serve',
      transformIndexHtml() {
        return [
          { tag: 'script', attrs: { src: './browser.dev.js' } },
        ]
      },
    },
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
})
