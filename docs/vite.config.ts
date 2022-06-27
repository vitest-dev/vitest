import fs from 'fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno } from 'unocss'
import { resolve } from 'pathe'
import { VitePWA } from 'vite-plugin-pwa'
import fg from 'fast-glob'
import {
  githubusercontentRegex,
  pwaFontStylesRegex,
  pwaFontsRegex,
  vitestDescription,
  vitestName,
  vitestShortName,
} from './.vitepress/meta'
import SponsorLinkFix from './plugins/FixSponsorLink'

export default defineConfig({
  plugins: [
    // TODO remove cast when moved to Vite 3
    Components({
      include: [/\.vue/, /\.md/],
      dirs: '.vitepress/components',
      dts: '.vitepress/components.d.ts',
    }) as Plugin,
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
    }) as unknown as Plugin,
    SponsorLinkFix(),
    IncludesPlugin(),
    VitePWA({
      outDir: '.vitepress/dist',
      registerType: 'autoUpdate',
      // include all static assets under public/
      includeAssets: fg.sync('**/*.{png,svg,ico,txt}', { cwd: resolve(__dirname, 'public') }),
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
        navigateFallbackDenylist: [/^\/new$/],
        globPatterns: ['**/*.{css,js,html,woff2}'],
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
            urlPattern: githubusercontentRegex,
            handler: 'CacheFirst',
            options: {
              cacheName: 'githubusercontent-images-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
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
