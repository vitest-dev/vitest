import { defineConfig, mergeConfig } from 'vite'
import { config } from './vite.config'

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
      transformIndexHtml(html) {
        return html.replace('<!-- !LOAD_METADATA! -->', '<script>window.METADATA_PATH="/html.meta.json"</script>')
      },
    },
  ],
})))
