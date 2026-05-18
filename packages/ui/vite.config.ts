import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'pathe'
import { presetAttributify, presetIcons, presetWind3, transformerDirectives } from 'unocss'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'

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
    process.env.HTML_REPORT_DIR
      ? devHtmlReportPlugin({ htmlDir: process.env.HTML_REPORT_DIR })
      : devUiScriptPlugin(),
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

function devHtmlReportPlugin({ htmlDir }: { htmlDir: string }): Plugin {
  const REPORT_FILE = 'html.meta.json.gz'
  return {
    name: 'dev-html-report',
    apply(_config, env) {
      return !!htmlDir && env.command === 'serve' && env.mode !== 'test'
    },
    async transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.METADATA_PATH="${REPORT_FILE}"`,
        },
      ]
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://localhost`)
        if (url.pathname === `/${REPORT_FILE}`) {
          const data = fs.readFileSync(path.join(htmlDir, REPORT_FILE))
          res.end(data)
          return
        }
        next()
      })
    },
  }
}
