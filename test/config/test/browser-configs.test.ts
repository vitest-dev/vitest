import type { ViteUserConfig } from 'vitest/config'
import type { UserConfig, VitestOptions } from 'vitest/node'
import crypto from 'node:crypto'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runVitestCli, useFS } from '../../test-utils'

async function vitest(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

test('assigns names as browsers', async () => {
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

test('filters projects with a wildcard', async () => {
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

function getCliConfig(options: UserConfig, cli: string[], fs: Record<string, string> = {}) {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(root, {
    ...fs,
    'basic.test.ts': /* ts */`
      import { test } from 'vitest'
      test('basic', () => {
        expect(1).toBe(1)
      })
    `,
    'vitest.config.ts': /* ts */ `
      export default {
        test: {
          reporters: [
            {
              onInit(vitest) {
                const browser = vitest.config.browser
                console.log(JSON.stringify({
                  browser: {
                    headless: browser.headless,
                    browser: browser.enabled,
                    ui: browser.ui,
                  },
                  workspace: vitest.projects.map(p => {
                    return {
                      name: p.name,
                      headless: p.config.browser.headless,
                      browser: p.config.browser.enabled,
                      ui: p.config.browser.ui,
                    }
                  })
                }))
                // throw an error to avoid running tests
                throw new Error('stop')
              },
            },
          ],
          ...${JSON.stringify(options)}
        }
      }
    `,
  })
  return runVitestCli(
    {
      nodeOptions: {
        env: {
          CI: 'false',
          GITHUB_ACTIONS: undefined,
        },
      },
    },
    '--root',
    root,
    '--no-watch',
    ...cli,
  )
}

test('[e2e] CLI options correctly override inline workspace options', async () => {
  const vitest = await getCliConfig({
    workspace: [
      {
        test: {
          name: 'unit',
        },
      },
      {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            headless: true,
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  }, ['--browser.headless=false'])

  const config = JSON.parse(vitest.stdout)

  expect(config.workspace).toHaveLength(2)
  expect(config.workspace[0].name).toBe('unit')
  expect(config.workspace[0].browser).toBe(false)

  expect(config.workspace[1].name).toBe('browser (chromium)')
  expect(config.workspace[1].headless).toBe(false)
  expect(config.workspace[1].browser).toBe(true)
  expect(config.workspace[1].ui).toBe(true)
})

test('[e2e] CLI options correctly override file workspace options', async () => {
  const vitest = await getCliConfig(
    {
      workspace: [
        {
          test: {
            name: 'unit',
          },
        },
        './vitest.browser.config.ts',
      ],
    },
    ['--browser.headless=false'],
    {
      'vitest.browser.config.ts': /* ts */ `
      export default {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            headless: true,
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      }
    `,
    },
  )

  const config = JSON.parse(vitest.stdout)

  expect(config.workspace).toHaveLength(2)
  expect(config.workspace[0].name).toBe('unit')
  expect(config.workspace[0].browser).toBe(false)

  expect(config.workspace[1].name).toBe('browser (chromium)')
  expect(config.workspace[1].headless).toBe(false)
  expect(config.workspace[1].browser).toBe(true)
  expect(config.workspace[1].ui).toBe(true)
})
