import { presetAttributify, presetIcons, presetUno } from 'unocss'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'
import {resolve} from "node:path";

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
      shortcuts: [
        ['btn', 'px-4 py-1 rounded inline-flex justify-center gap-2 text-white leading-30px children:mya !no-underline cursor-pointer disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
      ],
      presets: [
        presetUno({
          dark: 'media',
        }),
        presetAttributify(),
        presetIcons({
          scale: 1.2,
        }),
      ],
    }),
  ],
})
