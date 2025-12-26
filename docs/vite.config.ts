import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    // vitepress is aliased with replacement `join(DIST_CLIENT_PATH, '/index')`
    // This needs to be excluded from optimization
    exclude: ['@vueuse/core', 'vitepress', '@docsearch/css'],
  },
})
