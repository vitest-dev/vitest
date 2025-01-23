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
      headless: true,
      instances: [
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

test('filters projects', async () => {
  const { projects } = await vitest({
    project: 'chromium',
    browser: {
      enabled: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  })
  expect(projects.map(p => p.name)).toEqual([
    'chromium',
  ])
})

test('filters projects with a wildecard', async () => {
  const { projects } = await vitest({
    project: 'chrom*',
    browser: {
      enabled: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  })
  expect(projects.map(p => p.name)).toEqual([
    'chromium',
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
            headless: true,
            instances: [
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

test('inherits browser options', async () => {
  const { projects } = await vitest({
    setupFiles: ['/test/setup.ts'],
    provide: {
      browser: true,
    } as any,
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
      instances: [
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
      } as any,
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
      } as any,
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

test('coverage provider v8 works correctly in browser mode if instances are filtered', async () => {
  const { projects } = await vitest({
    project: 'chromium',
    coverage: {
      enabled: true,
      provider: 'v8',
    },
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  })
  expect(projects.map(p => p.name)).toEqual([
    'chromium',
  ])
})

test('coverage provider v8 works correctly in workspaced browser mode if instances are filtered', async () => {
  const { projects } = await vitest({
    project: 'browser (chromium)',
    workspace: [
      {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  })
  expect(projects.map(p => p.name)).toEqual([
    'browser (chromium)',
  ])
})

test('filter for the global browser project includes all browser instances', async () => {
  const { projects } = await vitest({
    project: 'myproject',
    workspace: [
      {
        test: {
          name: 'myproject',
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
      {
        test: {
          name: 'skip',
        },
      },
    ],
  })
  expect(projects.map(p => p.name)).toEqual([
    'myproject (chromium)',
    'myproject (firefox)',
    'myproject (webkit)',
  ])
})

test('can enable browser-cli options for multi-project workspace', async () => {
  const { projects } = await vitest(
    {
      browser: {
        enabled: true,
        headless: true,
      },
    },
    {
      workspace: [
        {
          test: {
            name: 'unit',
          },
        },
        {
          test: {
            browser: {
              enabled: true,
              provider: 'playwright',
              instances: [
                { browser: 'chromium', name: 'browser' },
              ],
            },
          },
        },
      ],
    },
  )
  expect(projects.map(p => p.name)).toEqual([
    'unit',
    'browser',
  ])

  // unit config
  expect(projects[0].config.browser.enabled).toBe(false)

  // browser config
  expect(projects[1].config.browser.enabled).toBe(true)
  expect(projects[1].config.browser.headless).toBe(true)
})
