import type { PwaOptions } from '@vite-pwa/vitepress'
import {
  githubusercontentRegex,
  pwaFontStylesRegex,
  pwaFontsRegex,
  vitestDescription,
  vitestName,
  vitestShortName,
} from '../meta'

export const pwa: PwaOptions = {
  outDir: '.vitepress/dist',
  registerType: 'autoUpdate',
  // include all static assets under public/
  manifest: {
    id: '/',
    name: vitestName,
    short_name: vitestShortName,
    description: vitestDescription,
    theme_color: '#ffffff',
    start_url: '/',
    lang: 'en-US',
    dir: 'ltr',
    orientation: 'natural',
    display: 'standalone',
    display_override: ['window-controls-overlay'],
    categories: ['development', 'developer tools'],
    icons: [
      {
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [{
      src: 'og.png',
      sizes: '2258x1185',
      type: 'image/png',
      label: `Screenshot of ${vitestName}`,
    }],
    handle_links: 'preferred',
    launch_handler: {
      client_mode: ['navigate-existing', 'auto'],
    },
    edge_side_panel: {
      preferred_width: 480,
    },
  },
  workbox: {
    navigateFallbackDenylist: [/^\/new$/],
    // warning: sponsors/antfu.svg is 2.51 MB, and won't be precached
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // <== 3MB
    globPatterns: ['**/*.{css,js,html,png,svg,ico,txt,woff2,json}'],
    // Rollup 4 change the layout: don't calculate revision (hash)
    dontCacheBustURLsMatching: /^assets\//,
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
  experimental: {
    includeAllowlist: true,
  },
}
