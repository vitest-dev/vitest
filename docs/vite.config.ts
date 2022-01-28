import fs from 'fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno } from 'unocss'
import { resolve } from 'pathe'
import { VitePWA } from 'vite-plugin-pwa'
import {
  pwaDisabled,
  pwaFontStylesRegex,
  pwaFontsRegex,
  pwaImagesRegex,
  vitestDescription,
  vitestName,
  vitestShortName,
} from './docs-data'

export default defineConfig({
  define: {
    'process.env.__PWA_DISABLED__': pwaDisabled,
  },
  plugins: [
    Components({
      include: [/\.vue/, /\.md/],
      dts: true,
    }),
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
    IncludesPlugin(),
    VitePWA({
      disable: pwaDisabled,
      outDir: '.vitepress/dist',
      // TODO: to add prompt strategy we should change to custom theme or switch to @vue/theme
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'robots.txt',
        'bg.png',
        'og.png',
        'netlify.svg',
      ],
      manifest: {
        id: '/',
        name: vitestName,
        short_name: vitestShortName,
        description: vitestDescription,
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo.svg',
            sizes: '165x165',
            type: 'image/svg',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: pwaFontsRegex,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: pwaFontStylesRegex,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: pwaImagesRegex,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                // github.com/{user}.png will redirect to avatars.githubusercontent.com
                statuses: [0, 200, 302],
              },
            },
          },
        ],
      },
    }),
  ],

  optimizeDeps: {
    include: [
      'vue',
      '@vueuse/core',
    ],
    exclude: [
      'vue-demi',
    ],
  },
})

function IncludesPlugin(): Plugin {
  return {
    name: 'include-plugin',
    enforce: 'pre',
    transform(code, id) {
      let changed = false
      code = code.replace(/\[@@include\]\((.*?)\)/, (_, url) => {
        changed = true
        const full = resolve(id, url)
        return fs.readFileSync(full, 'utf-8')
      })
      if (changed)
        return code
    },
  }
}
