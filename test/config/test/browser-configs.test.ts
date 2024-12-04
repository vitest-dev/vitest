import type { ViteUserConfig } from 'vitest/config'
import type { UserConfig, VitestOptions } from 'vitest/node'
import { expect, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  return await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
}

test('assignes names as browsers', async () => {
  const { projects } = await vitest({
    browser: {
      enabled: true,
      configs: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  })
  expect(projects.map(p => p.name)).toEqual([
    'chromium',
    'firefox',
    'webkit',
  ])
})

test('assignes names as browsers in a custom project', async () => {
  const { projects } = await vitest({
    workspace: [
      {
        test: {
          name: 'custom',
          browser: {
            enabled: true,
            configs: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
              { browser: 'webkit', name: 'hello-world' },
            ],
          },
        },
      },
    ],
  })
  expect(projects.map(p => p.name)).toEqual([
    'custom (chromium)',
    'custom (firefox)',
    'custom (webkit)',
    'hello-world',
  ])
})

test.only('inherits browser options', async () => {
  const { projects } = await vitest({
    setupFiles: ['/test/setup.ts'],
    provide: {
      browser: true,
    },
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      testerHtmlPath: '/custom-path.html',
      screenshotDirectory: '/custom-directory',
      fileParallelism: false,
      viewport: {
        width: 300,
        height: 900,
      },
      locators: {
        testIdAttribute: 'data-tid',
      },
      configs: [
        {
          browser: 'chromium',
          screenshotFailures: true,
        },
        {
          browser: 'firefox',
          screenshotFailures: true,
          locators: {
            testIdAttribute: 'data-custom',
          },
          viewport: {
            width: 900,
            height: 300,
          },
          testerHtmlPath: '/custom-overriden-path.html',
          screenshotDirectory: '/custom-overriden-directory',
        },
      ],
    },
  })
  expect(projects.map(p => p.config)).toMatchObject([
    {
      name: 'chromium',
      setupFiles: ['/test/setup.ts'],
      provide: {
        browser: true,
      },
      browser: {
        enabled: true,
        headless: true,
        screenshotFailures: true,
        screenshotDirectory: '/custom-directory',
        viewport: {
          width: 300,
          height: 900,
        },
        locators: {
          testIdAttribute: 'data-tid',
        },
        fileParallelism: false,
        testerHtmlPath: '/custom-path.html',
      },
    },
    {
      name: 'firefox',
      setupFiles: ['/test/setup.ts'],
      provide: {
        browser: true,
      },
      browser: {
        enabled: true,
        headless: true,
        screenshotFailures: true,
        viewport: {
          width: 900,
          height: 300,
        },
        screenshotDirectory: '/custom-overriden-directory',
        locators: {
          testIdAttribute: 'data-custom',
        },
        testerHtmlPath: '/custom-overriden-path.html',
      },
    },
  ])
})
