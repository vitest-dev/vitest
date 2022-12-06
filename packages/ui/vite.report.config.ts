import { defineConfig } from 'vite'
import defu from 'defu'
import { config } from './vite.config'

export default defineConfig(defu({
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
      transformIndexHtml(html) {
        return html.replace('<!-- !LOAD_METADATA! -->', '<script>window.METADATA_PATH="/html.meta.json"</script>')
      },
    },
  ],
}, config))
