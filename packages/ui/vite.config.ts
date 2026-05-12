import type { Plugin } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'pathe'
import { presetAttributify, presetIcons, presetWind3, transformerDirectives } from 'unocss'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'

// for debug:
// open a static file serve to share the report json
// and ui using the link to load the report json data
// const debugLink = 'http://127.0.0.1:4173/__vitest__'

export default defineConfig({
  base: './',
  resolve: {
    // TODO: keep manual alias for vite 7 CI
    // tsconfigPaths: true,
    alias: {
      '~/': `${resolve(import.meta.dirname, 'client')}/`,
    },
  },
  plugins: [
    Vue(),
    Unocss({
      presets: [presetWind3(), presetAttributify(), presetIcons()],
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
    devUiScriptPlugin(),
    // uncomment to see the HTML reporter preview
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
})

function devUiScriptPlugin(): Plugin {
  const UI_SCRIPT_RE = /<script>(window\.VITEST_API_TOKEN\s*=\s*"[^"]+")<\/script>/
  const BROWSER_SCRIPT_RE = /<script type="module">([\s\S]*?window\.__vitest_browser_runner__\s*=\s*\{[\s\S]*?window\.VITEST_API_TOKEN\s*=[\s\S]*?)<\/script>/

  const uiUrl = `http://localhost:${process.env.VITE_PORT || '51204'}/__vitest__/`
  const browserUrl = `http://localhost:${process.env.BROWSER_DEV_PORT || '63315'}/__vitest_test__/`

  return {
    name: 'dev-ui-script',
    apply(_config, env) {
      return env.command === 'serve' && env.mode !== 'test'
    },
    async transformIndexHtml() {
      if (process.env.BROWSER_DEV) {
        const response = await fetch(browserUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch browser runner HTML from ${browserUrl}`)
        }
        const browserHtml = await response.text()
        const browserScript = browserHtml.match(BROWSER_SCRIPT_RE)?.[1]
        if (!browserScript) {
          throw new Error('Failed to extract browser runner state from the response')
        }
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: browserScript,
            injectTo: 'head-prepend',
          },
        ]
      }

      const response = await fetch(uiUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch VITEST_API_TOKEN from ${uiUrl}`)
      }
      const testHtml = await response.text()
      const tokenScript = testHtml.match(UI_SCRIPT_RE)?.[1]
      if (!tokenScript) {
        throw new Error('Failed to extract VITEST_API_TOKEN from the response')
      }
      return [
        {
          tag: 'script',
          children: tokenScript,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}
