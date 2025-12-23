import { presetIcons, presetUno } from 'unocss'
import Unocss from 'unocss/vite'
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
  plugins: [
    Unocss({
      presets: [
        presetUno({
          dark: 'media',
          // use prefix to avoid conflicting tailwind class used by voidzero theme
          prefix: 'un-',
        }),
        presetIcons({
          scale: 1.2,
        }),
      ],
    }),
  ],
})
