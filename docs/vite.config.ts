import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  optimizeDeps: {
    // vitepress is aliased with replacement `join(DIST_CLIENT_PATH, '/index')`
    // This needs to be excluded from optimization
    exclude: ['@vueuse/core', 'vitepress', '@docsearch/css'],
  },
  server: {
    fs: {
      // Allow serving files from the linked theme package (parent directory)
      allow: [resolve(__dirname, '..', '..', '..')],
    },
    watch: {
      ignored: ['!**/node_modules/@voidzero-dev/**'],
    },
  },
  ssr: {
    noExternal: ['@voidzero-dev/vitepress-theme'],
  },
})
