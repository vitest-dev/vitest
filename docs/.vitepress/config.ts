import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { transformerNotationWordHighlight } from '@shikijs/transformers'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from 'vitepress-plugin-group-icons'
import llmstxt from 'vitepress-plugin-llms'
import { version } from '../../package.json'
import { teamMembers } from './contributors'
import {
  bluesky,
  contributing,
  discord,
  font,
  github,
  mastodon,
  ogImage,
  ogUrl,
  releases,
  vitestDescription,
  vitestName,
} from './meta'
import { pwa } from './scripts/pwa'
import { transformHead } from './scripts/transformHead'
import { extendConfig } from '@voidzero-dev/vitepress-theme/config'

export default ({ mode }: { mode: string }) => {
  return withPwa(extendConfig(defineConfig({
    lang: 'en-US',
    title: vitestName,
    description: vitestDescription,
    srcExclude: [
      '**/guide/examples/*',
      '**/guide/cli-generated.md',
    ],
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
      ['meta', { name: 'theme-color', content: '#22FF84' }],
      ['link', { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }],
      ['link', { rel: 'icon', href: '/logo-without-border.svg', type: 'image/svg+xml' }],
      ['meta', { name: 'author', content: `${teamMembers.map(c => c.name).join(', ')} and ${vitestName} contributors` }],
      ['meta', { name: 'keywords', content: 'vitest, vite, test, coverage, snapshot, react, vue, preact, svelte, solid, lit, marko, ruby, cypress, puppeteer, jsdom, happy-dom, test-runner, jest, typescript, esm, tinyspy, node' }],
      ['meta', { property: 'og:title', content: vitestName }],
      ['meta', { property: 'og:description', content: vitestDescription }],
      ['meta', { property: 'og:url', content: ogUrl }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['link', { rel: 'preload', as: 'style', onload: 'this.onload=null;this.rel=\'stylesheet\'', href: font }],
      ['noscript', {}, `<link rel="stylesheet" crossorigin="anonymous" href="${font}" />`],
      ['link', { rel: 'me', href: 'https://m.webtoo.ls/@vitest' }],
      ['link', { rel: 'mask-icon', href: '/logo.svg', color: '#ffffff' }],
      ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }],
      [
        'script',
        {
          'src': 'https://cdn.usefathom.com/script.js',
          'data-site': 'BEAFAKYG',
          'data-spa': 'auto',
          'defer': '',
        },
      ],
    ],
    lastUpdated: true,
    vite: {
      plugins: [
        groupIconVitePlugin({
          customIcon: {
            'CLI': 'vscode-icons:file-type-shell',
            '.spec.ts': 'vscode-icons:file-type-testts',
            '.test.ts': 'vscode-icons:file-type-testts',
            '.spec.js': 'vscode-icons:file-type-testjs',
            '.test.js': 'vscode-icons:file-type-testjs',
            'next': '',
          },
        }),
        llmstxt(),
      ],
    },
    markdown: {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(groupIconMdPlugin)
      },
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },
      codeTransformers: mode === 'development'
        ? [transformerNotationWordHighlight()]
        : [
            transformerNotationWordHighlight(),
            transformerTwoslash({
              processHoverInfo: (info) => {
                if (info.includes(process.cwd())) {
                  return info.replace(new RegExp(process.cwd(), 'g'), '')
                }
                return info
              },
            }),
          ],
      languages: ['js', 'jsx', 'ts', 'tsx'],
    },
    themeConfig: {
      variant: 'vitest',
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

      carbonAds: {
        code: 'CW7DVKJE',
        placement: 'vitestdev',
      },

      socialLinks: [
        { icon: 'bluesky', link: bluesky },
        { icon: 'mastodon', link: mastodon },
        { icon: 'discord', link: discord },
        { icon: 'github', link: github },
      ],

      footer: {
        copyright: `© ${new Date().getFullYear()} VoidZero Inc. and Vitest contributors.`,
        nav: [
          {
            title: 'Vitest',
            items: [
              { text: 'Guides', link: '/guide/' },
              { text: 'API', link: '/api/test' },
              { text: 'Config', link: '/config/' },
            ],
          },
          {
            title: 'Resources',
            items: [
              { text: 'Team', link: '/team' },
              { text: 'Blog', link: '/blog' },
              { text: 'Releases', link: releases },
            ],
          },
          {
            title: 'Versions',
            items: [
              { text: 'Unreleased Docs', link: 'https://main.vitest.dev/' },
              { text: 'Vitest v3 Docs', link: 'https://v3.vitest.dev/' },
              { text: 'Vitest v2 Docs', link: 'https://v2.vitest.dev/' },
              { text: 'Vitest v1 Docs', link: 'https://v1.vitest.dev/' },
              { text: 'Vitest v0 Docs', link: 'https://v0.vitest.dev/' },
            ],
          },
          /* {
            title: 'Legal',
            items: [
              { text: 'Terms & Conditions', link: 'https://voidzero.dev/terms' },
              { text: 'Privacy Policy', link: 'https://voidzero.dev/privacy' },
              { text: 'Cookie Policy', link: 'https://voidzero.dev/cookies' },
            ],
          }, */
        ],
        social: [
          { icon: 'github', link: github },
          { icon: 'discord', link: discord },
          // { icon: 'mastodon', link: mastodon }, -- the link shows github
          { icon: 'bluesky', link: bluesky },
        ],
      },

      nav: [
        { text: 'Guides', link: '/guide/', activeMatch: '^/guide/' },
        { text: 'API', link: '/api/test', activeMatch: '^/api/' },
        { text: 'Config', link: '/config/', activeMatch: '^/config/' },
        {
          text: 'Blog',
          link: '/blog',
        },
        {
          text: `v${version}`,
          items: [
            {
              items: [
                {
                  text: `v${version}`,
                  link: `https://github.com/vitest-dev/vitest/releases/tag/v${version}`,
                },
                {
                  text: 'Releases Notes',
                  link: releases,
                },
                {
                  text: 'Contributing',
                  link: contributing,
                },
                {
                  text: 'Team',
                  link: '/team',
                },
              ],
            },
            {
              items: [
                {
                  text: 'unreleased',
                  link: 'https://main.vitest.dev/',
                },
                {
                  text: 'v3.x',
                  link: 'https://v3.vitest.dev/',
                },
                {
                  text: 'v2.x',
                  link: 'https://v2.vitest.dev/',
                },
                {
                  text: 'v1.x',
                  link: 'https://v1.vitest.dev/',
                },
                {
                  text: 'v0.x',
                  link: 'https://v0.vitest.dev/',
                },
              ],
            },
          ],
        },
      ],

      sidebar: {
        '/config': [
          {
            text: 'Config Reference',
            collapsed: false,
            items: [
              {
                text: 'Config File',
                link: '/config/',
              },
              {
                text: 'include',
                link: '/config/include',
              },
              {
                text: 'exclude',
                link: '/config/exclude',
              },
              {
                text: 'includeSource',
                link: '/config/include-source',
              },
              {
                text: 'name',
                link: '/config/name',
              },
              {
                text: 'server',
                link: '/config/server',
              },
              {
                text: 'deps',
                link: '/config/deps',
              },
              {
                text: 'runner',
                link: '/config/runner',
              },
              {
                text: 'benchmark',
                link: '/config/benchmark',
              },
              {
                text: 'alias',
                link: '/config/alias',
              },
              {
                text: 'globals',
                link: '/config/globals',
              },
              {
                text: 'environment',
                link: '/config/environment',
              },
              {
                text: 'environmentOptions',
                link: '/config/environmentoptions',
              },
              {
                text: 'watch',
                link: '/config/watch',
              },
              {
                text: 'watchTriggerPatterns',
                link: '/config/watchtriggerpatterns',
              },
              {
                text: 'root',
                link: '/config/root',
              },
              {
                text: 'dir',
                link: '/config/dir',
              },
              {
                text: 'reporters',
                link: '/config/reporters',
              },
              {
                text: 'outputFile',
                link: '/config/outputfile',
              },
              {
                text: 'pool',
                link: '/config/pool',
              },
              {
                text: 'execArgv',
                link: '/config/execargv',
              },
              {
                text: 'vmMemoryLimit',
                link: '/config/vmmemorylimit',
              },
              {
                text: 'fileParallelism',
                link: '/config/fileparallelism',
              },
              {
                text: 'maxWorkers',
                link: '/config/maxworkers',
              },
              {
                text: 'testTimeout',
                link: '/config/testtimeout',
              },
              {
                text: 'hookTimeout',
                link: '/config/hooktimeout',
              },
              {
                text: 'teardownTimeout',
                link: '/config/teardowntimeout',
              },
              {
                text: 'silent',
                link: '/config/silent',
              },
              {
                text: 'setupFiles',
                link: '/config/setupfiles',
              },
              {
                text: 'provide',
                link: '/config/provide',
              },
              {
                text: 'globalSetup',
                link: '/config/globalsetup',
              },
              {
                text: 'forceRerunTriggers',
                link: '/config/forcereruntriggers',
              },
              {
                text: 'coverage',
                link: '/config/coverage',
              },
              {
                text: 'testNamePattern',
                link: '/config/testnamepattern',
              },
              {
                text: 'ui',
                link: '/config/ui',
              },
              {
                text: 'open',
                link: '/config/open',
              },
              {
                text: 'api',
                link: '/config/api',
              },
              {
                text: 'clearMocks',
                link: '/config/clearmocks',
              },
              {
                text: 'mockReset',
                link: '/config/mockreset',
              },
              {
                text: 'restoreMocks',
                link: '/config/restoremocks',
              },
              {
                text: 'unstubEnvs',
                link: '/config/unstubenvs',
              },
              {
                text: 'unstubGlobals',
                link: '/config/unstubglobals',
              },
              {
                text: 'snapshotFormat',
                link: '/config/snapshotformat',
              },
              {
                text: 'snapshotSerializers',
                link: '/config/snapshotserializers',
              },
              {
                text: 'resolveSnapshotPath',
                link: '/config/resolvesnapshotpath',
              },
              {
                text: 'allowOnly',
                link: '/config/allowonly',
              },
              {
                text: 'passWithNoTests',
                link: '/config/passwithnotests',
              },
              {
                text: 'logHeapUsage',
                link: '/config/logheapusage',
              },
              {
                text: 'css',
                link: '/config/css',
              },
              {
                text: 'maxConcurrency',
                link: '/config/maxconcurrency',
              },
              {
                text: 'cache',
                link: '/config/cache',
              },
              {
                text: 'sequence',
                link: '/config/sequence',
              },
              {
                text: 'tags',
                link: '/config/tags',
              },
              {
                text: 'strictTags',
                link: '/config/stricttags',
              },
              {
                text: 'typecheck',
                link: '/config/typecheck',
              },
              {
                text: 'slowTestThreshold',
                link: '/config/slowtestthreshold',
              },
              {
                text: 'chaiConfig',
                link: '/config/chaiconfig',
              },
              {
                text: 'bail',
                link: '/config/bail',
              },
              {
                text: 'retry',
                link: '/config/retry',
              },
              {
                text: 'onConsoleLog',
                link: '/config/onconsolelog',
              },
              {
                text: 'onStackTrace',
                link: '/config/onstacktrace',
              },
              {
                text: 'onUnhandledError',
                link: '/config/onunhandlederror',
              },
              {
                text: 'dangerouslyIgnoreUnhandled...',
                link: '/config/dangerouslyignoreunhandlederrors',
              },
              {
                text: 'diff',
                link: '/config/diff',
              },
              {
                text: 'fakeTimers',
                link: '/config/faketimers',
              },
              {
                text: 'projects',
                link: '/config/projects',
              },
              {
                text: 'isolate',
                link: '/config/isolate',
              },
              {
                text: 'includeTaskLocation',
                link: '/config/includetasklocation',
              },
              {
                text: 'snapshotEnvironment',
                link: '/config/snapshotenvironment',
              },
              {
                text: 'env',
                link: '/config/env',
              },
              {
                text: 'expect',
                link: '/config/expect',
              },
              {
                text: 'printConsoleTrace',
                link: '/config/printconsoletrace',
              },
              {
                text: 'attachmentsDir',
                link: '/config/attachmentsdir',
              },
              {
                text: 'hideSkippedTests',
                link: '/config/hideskippedtests',
              },
              {
                text: 'mode',
                link: '/config/mode',
              },
              {
                text: 'expandSnapshotDiff',
                link: '/config/expandsnapshotdiff',
              },
              {
                text: 'disableConsoleIntercept',
                link: '/config/disableconsoleintercept',
              },
              {
                text: 'experimental',
                link: '/config/experimental',
              },
            ],
          },
          {
            text: 'Browser Mode',
            collapsed: false,
            items: [
              {
                text: 'Providers',
                collapsed: false,
                items: [
                  {
                    text: 'playwright',
                    link: '/config/browser/playwright',
                  },
                  {
                    text: 'webdriverio',
                    link: '/config/browser/webdriverio',
                  },
                  {
                    text: 'preview',
                    link: '/config/browser/preview',
                  },
                ],
              },
              {
                text: 'browser.enabled',
                link: '/config/browser/enabled',
              },
              {
                text: 'browser.instances',
                link: '/config/browser/instances',
              },
              {
                text: 'browser.headless',
                link: '/config/browser/headless',
              },
              {
                text: 'browser.isolate',
                link: '/config/browser/isolate',
              },
              {
                text: 'browser.testerHtmlPath',
                link: '/config/browser/testerhtmlpath',
              },
              {
                text: 'browser.api',
                link: '/config/browser/api',
              },
              {
                text: 'browser.provider',
                link: '/config/browser/provider',
              },
              {
                text: 'browser.ui',
                link: '/config/browser/ui',
              },
              {
                text: 'browser.detailsPanelPosition',
                link: '/config/browser/detailspanelposition',
              },
              {
                text: 'browser.viewport',
                link: '/config/browser/viewport',
              },
              {
                text: 'browser.locators',
                link: '/config/browser/locators',
              },
              {
                text: 'browser.screenshotDirectory',
                link: '/config/browser/screenshotdirectory',
              },
              {
                text: 'browser.screenshotFailures',
                link: '/config/browser/screenshotfailures',
              },
              {
                text: 'browser.orchestratorScripts',
                link: '/config/browser/orchestratorscripts',
              },
              {
                text: 'browser.commands',
                link: '/config/browser/commands',
              },
              {
                text: 'browser.connectTimeout',
                link: '/config/browser/connecttimeout',
              },
              {
                text: 'browser.trace',
                link: '/config/browser/trace',
              },
              {
                text: 'browser.trackUnhandledErrors',
                link: '/config/browser/trackunhandlederrors',
              },
              {
                text: 'browser.expect',
                link: '/config/browser/expect',
              },
            ],
          },
          // {
          //   text: '@vitest/plugin-eslint',
          //   collapsed: true,
          //   items: [
          //     {
          //       text: 'Lints',
          //       link: '/config/eslint',
          //     },
          //     // TODO: generate
          //     {
          //       text: 'consistent-test-filename',
          //       link: '/config/eslint/consistent-test-filename',
          //     },
          //     {
          //       text: 'consistent-test-it',
          //       link: '/config/eslint/consistent-test-it',
          //     },
          //   ],
          // },
          // {
          //   text: 'vscode',
          //   link: '/config/vscode',
          // },
        ],
        '/guide': [
          {
            text: 'Introduction',
            collapsed: false,
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
            ],
          },
          {
            text: 'Browser Mode',
            collapsed: false,
            items: [
              {
                text: 'Why Browser Mode',
                link: '/guide/browser/why',
                docFooterText: 'Why Browser Mode | Browser Mode',
              },
              {
                text: 'Getting Started',
                link: '/guide/browser/',
                docFooterText: 'Getting Started | Browser Mode',
              },
              {
                text: 'Multiple Setups',
                link: '/guide/browser/multiple-setups',
                docFooterText: 'Multiple Setups | Browser Mode',
              },
              {
                text: 'Component Testing',
                link: '/guide/browser/component-testing',
                docFooterText: 'Component Testing | Browser Mode',
              },
              {
                text: 'Visual Regression Testing',
                link: '/guide/browser/visual-regression-testing',
                docFooterText: 'Visual Regression Testing | Browser Mode',
              },
              {
                text: 'Trace View',
                link: '/guide/browser/trace-view',
                docFooterText: 'Trace View | Browser Mode',
              },
            ],
          },
          {
            text: 'Guides',
            collapsed: false,
            items: [
              {
                text: 'CLI',
                link: '/guide/cli',
              },
              {
                text: 'Test Filtering',
                link: '/guide/filtering',
              },
              {
                text: 'Test Tags',
                link: '/guide/test-tags',
              },
              {
                text: 'Test Context',
                link: '/guide/test-context',
              },
              {
                text: 'Test Environment',
                link: '/guide/environment',
              },
              {
                text: 'Test Run Lifecycle',
                link: '/guide/lifecycle',
              },
              {
                text: 'Snapshot',
                link: '/guide/snapshot',
              },
              {
                text: 'Mocking',
                link: '/guide/mocking',
                collapsed: true,
                items: [
                  {
                    text: 'Mocking Dates',
                    link: '/guide/mocking/dates',
                  },
                  {
                    text: 'Mocking Functions',
                    link: '/guide/mocking/functions',
                  },
                  {
                    text: 'Mocking Globals',
                    link: '/guide/mocking/globals',
                  },
                  {
                    text: 'Mocking Modules',
                    link: '/guide/mocking/modules',
                  },
                  {
                    text: 'Mocking the File System',
                    link: '/guide/mocking/file-system',
                  },
                  {
                    text: 'Mocking Requests',
                    link: '/guide/mocking/requests',
                  },
                  {
                    text: 'Mocking Timers',
                    link: '/guide/mocking/timers',
                  },
                  {
                    text: 'Mocking Classes',
                    link: '/guide/mocking/classes',
                  },
                ],
              },
              {
                text: 'Parallelism',
                link: '/guide/parallelism',
              },
              {
                text: 'Test Projects',
                link: '/guide/projects',
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
                text: 'Testing Types',
                link: '/guide/testing-types',
              },
              {
                text: 'Vitest UI',
                link: '/guide/ui',
              },
              {
                text: 'In-Source Testing',
                link: '/guide/in-source',
              },
              {
                text: 'Test Annotations',
                link: '/guide/test-annotations',
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
                text: 'Common Errors',
                link: '/guide/common-errors',
              },
              {
                text: 'Migration Guide',
                link: '/guide/migration',
                collapsed: false,
                items: [
                  {
                    text: 'Migrating to Vitest 4.0',
                    link: '/guide/migration#vitest-4',
                  },
                  {
                    text: 'Migrating from Jest',
                    link: '/guide/migration#jest',
                  },
                  {
                    text: 'Migrating from Mocha + Chai + Sinon',
                    link: '/guide/migration#mocha-chai-sinon',
                  },
                ],
              },
              {
                text: 'Performance',
                collapsed: false,
                items: [
                  {
                    text: 'Profiling Test Performance',
                    link: '/guide/profiling-test-performance',
                  },
                  {
                    text: 'Improving Performance',
                    link: '/guide/improving-performance',
                  },
                ],
              },
              {
                text: 'OpenTelemetry',
                link: '/guide/open-telemetry',
              },
            ],
          },
          {
            text: 'Advanced',
            collapsed: false,
            items: [
              {
                text: 'Getting Started',
                link: '/guide/advanced/',
              },
              {
                text: 'Running Tests via API',
                link: '/guide/advanced/tests',
              },
              {
                text: 'Extending Reporters',
                link: '/guide/advanced/reporters',
              },
              {
                text: 'Custom Pool',
                link: '/guide/advanced/pool',
              },
            ],
          },
          {
            items: [
              {
                text: 'Recipes',
                link: '/guide/recipes',
              },
              {
                text: 'Comparisons',
                link: '/guide/comparisons',
              },
            ],
          },
        ],
        '/api': [
          {
            text: 'Test API Reference',
            items: [
              {
                text: 'Test',
                link: '/api/test',
              },
              {
                text: 'Describe',
                link: '/api/describe',
              },
              {
                text: 'Hooks',
                link: '/api/hooks',
              },
            ],
          },
          {
            text: 'Mocks',
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
            text: 'Assert',
            link: '/api/assert',
          },
          {
            text: 'AssertType',
            link: '/api/assert-type',
          },
          {
            text: 'Browser Mode',
            items: [
              {
                text: 'Render Function',
                collapsed: false,
                items: [
                  {
                    text: 'react',
                    link: '/api/browser/react',
                  },
                  {
                    text: 'vue',
                    link: '/api/browser/vue',
                  },
                  {
                    text: 'svelte',
                    link: '/api/browser/svelte',
                  },
                  // {
                  //   text: 'angular',
                  //   link: '/api/browser/angular',
                  // },
                ],
              },
              {
                text: 'Context',
                link: '/api/browser/context',
              },
              {
                text: 'Interactivity',
                link: '/api/browser/interactivity',
              },
              {
                text: 'Locators',
                link: '/api/browser/locators',
              },
              {
                text: 'Assertions',
                link: '/api/browser/assertions',
              },
              {
                text: 'Commands',
                link: '/api/browser/commands',
              },
            ],
          },
          {
            text: 'Advanced',
            collapsed: false,
            items: [
              {
                text: 'Vitest',
                link: '/api/advanced/vitest',
              },
              {
                text: 'TestProject',
                link: '/api/advanced/test-project',
              },
              {
                text: 'TestSpecification',
                link: '/api/advanced/test-specification',
              },
              {
                text: 'TestCase',
                link: '/api/advanced/test-case',
              },
              {
                text: 'TestSuite',
                link: '/api/advanced/test-suite',
              },
              {
                text: 'TestModule',
                link: '/api/advanced/test-module',
              },
              {
                text: 'TestCollection',
                link: '/api/advanced/test-collection',
              },
              {
                text: 'VitestPlugin',
                link: '/api/advanced/plugin',
              },
              {
                text: 'VitestRunner',
                link: '/api/advanced/runner',
              },
              {
                text: 'Reporter',
                link: '/api/advanced/reporters',
              },
              {
                text: 'TaskMeta',
                link: '/api/advanced/metadata',
              },
              {
                text: 'TestArtifact',
                link: '/api/advanced/artifacts',
              },
            ],
          },
          // {
          //   text: 'Text Runner',
          //   collapsed: false,
          //   items: [
          //     // TODO: generate
          //     {
          //       text: 'test',
          //       link: '/api/test',
          //     },
          //     {
          //       text: 'describe',
          //       link: '/api/describe',
          //     },
          //     {
          //       text: 'beforeEach',
          //       link: '/api/before-each',
          //     },
          //     {
          //       text: 'afterEach',
          //       link: '/api/after-each',
          //     },
          //   ],
          // },
          // {
          //   text: 'Assertion API',
          //   collapsed: false,
          //   items: [
          //     {
          //       text: 'expect',
          //       link: '/api/expect',
          //     },
          //     {
          //       text: 'assert',
          //       link: '/api/assert',
          //     },
          //     {
          //       text: 'expectTypeOf',
          //       link: '/api/expect-typeof',
          //     },
          //     {
          //       text: 'assertType',
          //       link: '/api/assert-type',
          //     },
          //   ],
          // },
          // {
          //   text: 'Vi Utility API',
          //   collapsed: false,
          //   items: [
          //     {
          //       text: 'Mock Modules',
          //       link: '/api/vi/mock-modiles',
          //     },
          //     {
          //       text: 'Mock Functions',
          //       link: '/api/vi/mock-functions',
          //     },
          //     {
          //       text: 'Mock Timers',
          //       link: '/api/vi/mock-timers',
          //     },
          //     {
          //       text: 'Miscellaneous',
          //       link: '/api/vi/miscellaneous',
          //     },
          //   ],
          // },
          // {
          //   text: 'Browser Mode',
          //   collapsed: false,
          //   items: [
          //     // TODO: generate
          //     {
          //       text: 'page',
          //       link: '/api/browser/page',
          //     },
          //     {
          //       text: 'locators',
          //       link: '/api/browser/locators',
          //     },
          //   ],
          // },
        ],
      },
    },
    pwa,
    transformHead,
  })))
}
