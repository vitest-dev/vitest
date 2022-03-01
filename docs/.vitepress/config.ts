
import { defineConfig } from 'vitepress'
import { version } from '../../package.json'
import {
  contributing,
  discord,
  font,
  ogImage,
  ogUrl,
  releases,
  twitter,
  vitestDescription,
  vitestName
} from "../docs-data";
// noinspection ES6PreferShortImport: IntelliJ IDE hint to avoid warning to use `~/contributors`, will fail on build if changed
import { coreTeamMembers } from '../src/contributors'

export default defineConfig({
  title: vitestName,
  description: vitestDescription,
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'alternate icon', href: '/favicon.ico', type: 'image/png', sizes: '16x16' }],
    ['meta', { name: 'author', content: `${coreTeamMembers.map(c => c.name).join(', ')} and ${vitestName} contributors` }],
    // TODO: review this
    ['meta', { name: 'keywords', content: 'vitest, vite, test, coverage, snapshot, react, vue, preact, svelte, solid, lit, ruby, cypress, puppeteer, jsdom, happy-dom, test-runner, jest, typescript, esm, tinypool, tinyspy, c8, node' }],
    ['meta', { property: 'og:title', content: vitestName }],
    ['meta', { property: 'og:description', content: vitestDescription }],
    ['meta', { property: 'og:url', content: ogUrl }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:title', content: vitestName }],
    ['meta', { name: 'twitter:description', content: vitestDescription }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { href: font, rel: 'stylesheet' }],
    ['link', { rel: 'mask-icon', href: '/logo.svg', color: '#ffffff' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: "180x180" }],
  ],
  themeConfig: {
    repo: 'vitest-dev/vitest',
    logo: '/logo.svg',
    docsDir: 'docs',
    docsBranch: 'main',
    editLinks: true,
    editLinkText: 'Suggest changes to this page',

    algolia: {
      appId: 'ZTF29HGJ69',
      apiKey: '9c3ced6fed60d2670bb36ab7e8bed8bc',
      indexName: 'vitest'
      // searchParameters: {
      //   facetFilters: ['tags:en']
      // }
    },

    /* TODO

    carbonAds: {
      carbon: '...',
      placement: 'vitest'
    },
    */

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Config', link: '/config/' },
      // { text: 'Plugins', link: '/plugins/' },
      {
        text: `v${version}`,
        items: [
          {
            text: 'Release Notes ',
            link: releases,
          },
          {
            text: 'Contributing ',
            link: contributing,
          },
        ],

      },
      {
        text: 'Discord',
        link: discord,
      },
      {
        text: 'Twitter',
        link: twitter,
      },
      /* TODO
      {
        text: 'Languages',
        items: [
          {
            text: 'English',
            link: 'https://vitest.dev'
          },
          {
            text: '简体中文',
            link: 'https://cn.vitest.dev'
          },
          {
            text: '日本語',
            link: 'https://ja.vitest.dev'
          }
        ]
      }
      */
    ],

    sidebar: {
      '/config/': 'auto',
      '/api/': 'auto',
      // '/plugins': 'auto',
      // catch-all fallback
      '/': [
        {
          text: 'Guide',
          children: [
            {
              text: 'Why Vitest',
              link: '/guide/why',

            },
            {
              text: 'Getting Started',
              link: '/guide/'
            },
            {
              text: 'Features',
              link: '/guide/features'
            },
            {
              text: 'Mocking',
              link: '/guide/mocking'
            },
            {
              text: 'Debugging',
              link: '/guide/debugging'
            },
            /* TODO
            {
              text: 'Using Plugins',
              link: '/guide/using-plugins'
            },
            */
            {
              text: 'Comparisons',
              link: '/guide/comparisons'
            },
            {
              text: 'Migration Guide',
              link: '/guide/migration'
            },
          ]
        },
        /* TODO
        {
          text: 'APIs',
          children: [
            {
              text: 'Plugin API',
              link: '/guide/api-plugin'
            },
            {
              text: 'Config Reference',
              link: '/config/'
            }
          ]
        },
        */
      ]
    }
  }
})
