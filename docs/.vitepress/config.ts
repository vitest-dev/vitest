import { defineConfig } from 'vitepress'
import { withPwa } from '@vite-pwa/vitepress'
import { version } from '../../package.json'
import {
  contributing,
  discord,
  font,
  github,
  mastodon,
  ogImage,
  ogUrl,
  releases,
  twitter,
  vitestDescription,
  vitestName,
} from './meta'
import { pwa } from './scripts/pwa'
import { transformHead } from './scripts/transformHead'
import { teamMembers } from './contributors'

export default withPwa(defineConfig({
  lang: 'en-US',
  title: vitestName,
  description: vitestDescription,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
    },
    zh: {
      label: '简体中文',
      lang: 'zh',
      link: 'https://cn.vitest.dev/',
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#729b1a' }],
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'author', content: `${teamMembers.map(c => c.name).join(', ')} and ${vitestName} contributors` }],
    ['meta', { name: 'keywords', content: 'vitest, vite, test, coverage, snapshot, react, vue, preact, svelte, solid, lit, marko, ruby, cypress, puppeteer, jsdom, happy-dom, test-runner, jest, typescript, esm, tinypool, tinyspy, node' }],
    ['meta', { property: 'og:title', content: vitestName }],
    ['meta', { property: 'og:description', content: vitestDescription }],
    ['meta', { property: 'og:url', content: ogUrl }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:title', content: vitestName }],
    ['meta', { name: 'twitter:description', content: vitestDescription }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preload', as: 'style', onload: 'this.onload=null;this.rel=\'stylesheet\'', href: font }],
    ['noscript', {}, `<link rel="stylesheet" crossorigin="anonymous" href="${font}" />`],
    ['link', { rel: 'mask-icon', href: '/logo.svg', color: '#ffffff' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }],
  ],
  lastUpdated: true,
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  themeConfig: {
    logo: '/logo.svg',

    editLink: {
      pattern: 'https://github.com/vitest-dev/vitest/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },

    search: {
      provider: 'local',
      /* provider: 'algolia',
      options: {
        appId: 'ZTF29HGJ69',
        apiKey: '9c3ced6fed60d2670bb36ab7e8bed8bc',
        indexName: 'vitest',
        // searchParameters: {
        //   facetFilters: ['tags:en'],
        // },
      }, */
    },

    socialLinks: [
      { icon: 'mastodon', link: mastodon },
      { icon: 'x', link: twitter },
      { icon: 'discord', link: discord },
      { icon: 'github', link: github },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2021-PRESENT Anthony Fu, Matías Capeletto and Vitest contributors',
    },

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'API', link: '/api/', activeMatch: '^/api/' },
      { text: 'Config', link: '/config/', activeMatch: '^/config/' },
      { text: 'Advanced', link: '/advanced/api', activeMatch: '^/advanced/' },
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
    ],

    sidebar: {
      // TODO: bring sidebar of apis and config back
      '/advanced': [
        {
          text: 'Advanced',
          items: [
            {
              text: 'Vitest Node API',
              link: '/advanced/api',
            },
            {
              text: 'Runner API',
              link: '/advanced/runner',
            },
            {
              text: 'Task Metadata',
              link: '/advanced/metadata',
            },
            {
              text: 'Extending Reporters',
              link: '/advanced/reporters',
            },
            {
              text: 'Custom Pool',
              link: '/advanced/pool',
            },
          ],
        },
      ],
      '/': [
        {
          text: 'Guide',
          items: [
            {
              text: 'Why Vitest',
              link: '/guide/why',
            },
            {
              text: 'Getting Started',
              link: '/guide/',
            },
            {
              text: 'Features',
              link: '/guide/features',
            },
            {
              text: 'Workspace',
              link: '/guide/workspace',
            },
            {
              text: 'CLI',
              link: '/guide/cli',
            },
            {
              text: 'Test Filtering',
              link: '/guide/filtering',
            },
            {
              text: 'Reporters',
              link: '/guide/reporters',
            },
            {
              text: 'Coverage',
              link: '/guide/coverage',
            },
            {
              text: 'Snapshot',
              link: '/guide/snapshot',
            },
            {
              text: 'Mocking',
              link: '/guide/mocking',
            },
            {
              text: 'Testing Types',
              link: '/guide/testing-types',
            },
            {
              text: 'Vitest UI',
              link: '/guide/ui',
            },
            {
              text: 'Browser Mode',
              link: '/guide/browser',
            },
            {
              text: 'In-Source Testing',
              link: '/guide/in-source',
            },
            {
              text: 'Test Context',
              link: '/guide/test-context',
            },
            {
              text: 'Environment',
              link: '/guide/environment',
            },
            {
              text: 'Extending Matchers',
              link: '/guide/extending-matchers',
            },
            {
              text: 'IDE Integration',
              link: '/guide/ide',
            },
            {
              text: 'Debugging',
              link: '/guide/debugging',
            },
            {
              text: 'Comparisons',
              link: '/guide/comparisons',
            },
            {
              text: 'Migration Guide',
              link: '/guide/migration',
            },
            {
              text: 'Common Errors',
              link: '/guide/common-errors',
            },
            {
              text: 'Improving Performance',
              link: '/guide/improving-performance',
            },
          ],
        },
        {
          text: 'API',
          items: [
            {
              text: 'Test API Reference',
              link: '/api/',
            },
            {
              text: 'Mock Functions',
              link: '/api/mock',
            },
            {
              text: 'Vi Utility',
              link: '/api/vi',
            },
            {
              text: 'Expect',
              link: '/api/expect',
            },
            {
              text: 'ExpectTypeOf',
              link: '/api/expect-typeof',
            },
            {
              text: 'AssertType',
              link: '/api/assert-type',
            },
          ],
        },
        {
          text: 'Config',
          items: [
            {
              text: 'Config Reference',
              link: '/config/',
            },
          ],
        },
      ],
    },
  },
  pwa,
  transformHead,
}))
