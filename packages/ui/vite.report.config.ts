import { defineConfig, mergeConfig } from 'vite'
import { config } from './vite.config'

// for debug:
// open a static file serve to share the report json
// and ui using the link to load the report json data
const debugLink = 'http://127.0.0.1:4173'

export default defineConfig(mergeConfig(config, defineConfig({
  base: './',
  build: {
    outDir: 'dist/report',
  },
  define: {
    __REPORT__: true,
  },
  plugins: [
    {
      name: 'debug-html-report',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace('<!-- !LOAD_METADATA! -->', `<script>window.METADATA_PATH="${debugLink}/html.meta.json"</script>`)
      },
    },
  ],
})))
