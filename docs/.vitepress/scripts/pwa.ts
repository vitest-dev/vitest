import type { VitePWAOptions } from 'vite-plugin-pwa'
import {
  githubusercontentRegex,
  pwaFontStylesRegex,
  pwaFontsRegex,
  vitestDescription,
  vitestName,
  vitestShortName,
} from '../meta'

export const pwa: Partial<VitePWAOptions> = {
  outDir: '.vitepress/dist',
  registerType: 'autoUpdate',
  // include all static assets under public/
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
    globPatterns: ['**/*.{css,js,html,png,svg,ico,txt,woff2}'],
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
}
