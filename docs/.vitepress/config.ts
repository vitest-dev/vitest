import { defineConfig } from 'vitepress'
import { version } from '../../package.json'

export default defineConfig({
  title: 'Vitest',
  description: 'A blazing fast unit test framework powered by Vite',
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'author', content: 'Anthony Fu, Patak, Aslemammad, Vladimir' }],
    // TODO: review this
    ['meta', { name: 'keywords', content: 'vitest, vite, react, vue, preact, svelte, solid, lit, ruby, puppeteer, jsdom, happy-dom, node' }],
    ['meta', { property: 'og:title', content: 'Vitest' }],
    ['meta', { property: 'og:description', content: 'A blazing fast unit tets framework powered by Vite' }],
    ['meta', { property: 'og:url', content: 'https://vitest.dev/' }],
    ['meta', { property: 'og:image', content: 'https://vitest.dev/og.png' }],
    ['meta', { name: 'twitter:title', content: 'Vitest' }],
    ['meta', { name: 'twitter:description', content: 'A blazing fast unit test framework powered by Vite' }],
    ['meta', { name: 'twitter:image', content: 'https://vitest.dev/og.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@200;400;600&display=swap', rel: 'stylesheet' }],
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

    /* TODO

    algolia: {
      apiKey: '...',
      indexName: 'vitest',
      searchParameters: {
        facetFilters: ['tags:en']
      }
    },

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
            link: 'https://github.com/vitest-dev/vitest/releases',
          },
          {
            text: 'Contributing ',
            link: 'https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md',
          },
        ],

      },
      {
        text: 'Discord',
        link: 'https://chat.vitest.dev'
      },
      {
        text: 'Twitter',
        link: 'https://twitter.com/vitest_dev'
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
            }
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
