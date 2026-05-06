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
      apply(_config, env) {
        return env.command === 'serve' && env.mode !== 'test'
      },
      async transformIndexHtml() {
        if (process.env.BROWSER_DEV_PREVIEW) {
          const browserOrigin = `http://localhost:${process.env.VITEST_BROWSER_DEV_PORT || '63315'}`
          const response = await fetch(new URL('/__vitest_test__/', browserOrigin))
          assert(response.ok, `Failed to fetch browser runner HTML from ${browserOrigin}/__vitest_test__/`)
          const browserHtml = await response.text()
          const browserScript = browserHtml.match(/<script type="module">([\s\S]*?window\.__vitest_browser_runner__\s*=\s*\{[\s\S]*?window\.VITEST_API_TOKEN\s*=\s*[\s\S]*?)<\/script>/)?.[1]
          assert(browserScript, 'Failed to extract browser runner state from the response')
          assert(!browserScript.includes('sessionId: "none"'), 'Browser runner session is not active')
          return [
            {
              tag: 'script',
              attrs: { type: 'module' },
              children: browserScript,
              injectTo: 'head-prepend',
            },
          ]
        }

        const apiOrigin = `http://localhost:${process.env.VITE_PORT || '51204'}`
        const response = await fetch(new URL('/__vitest__/', apiOrigin))
        assert(response.ok, `Failed to fetch VITEST_API_TOKEN from ${apiOrigin}/__vitest__/`)
        const testHtml = await response.text()
        const tokenScript = testHtml.match(/<script>(window\.VITEST_API_TOKEN\s*=\s*"[^"]+")<\/script>/)?.[1]
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
