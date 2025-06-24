import type { ViteUserConfig } from 'vitest/config'
import type { TestUserConfig, VitestOptions } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils'
import crypto from 'node:crypto'
import { resolve } from 'pathe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runVitestCli, useFS } from '../../test-utils'

async function vitest(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

test('assigns names as browsers', async () => {
  const { projects } = await vitest({}, {
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
  const { projects } = await vitest({ project: 'chromium' }, {
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
  const { projects } = await vitest({ project: 'chrom*' }, {
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
  const { projects } = await vitest({}, {
    projects: [
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
  const { projects } = await vitest({}, {
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
  const { projects } = await vitest(
    {
      project: 'chromium',
    },
    {
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
    },
  )
  expect(projects.map(p => p.name)).toEqual([
    'chromium',
  ])
})

test('coverage provider v8 works correctly in workspaced browser mode if instances are filtered', async () => {
  const { projects } = await vitest({ project: 'browser (chromium)' }, {
    projects: [
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
  const { projects } = await vitest({ project: 'myproject' }, {
    projects: [
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
      projects: [
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

function getCliConfig(options: TestUserConfig, cli: string[], fs: TestFsStructure = {}) {
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
                const workspace = (p) => ({
                  name: p.name,
                  headless: p.config.browser.headless,
                  browser: p.config.browser.enabled,
                  ui: p.config.browser.ui,
                })
                console.log(JSON.stringify({
                  browser: {
                    headless: browser.headless,
                    browser: browser.enabled,
                    ui: browser.ui,
                  },
                  workspace: vitest.projects.map(p => {
                    return {
                      ...workspace(p),
                      parent: p._parent ? workspace(p._parent) : null,
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

describe('[e2e] workspace configs are affected by the CLI options', () => {
  test('UI is not enabled by default in headless config', async () => {
    const vitest = await getCliConfig({
      projects: [
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
              provider: 'playwright',
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            },
          },
        },
      ],
    }, [])

    const config = JSON.parse(vitest.stdout)

    expect(config.workspace).toHaveLength(2)
    expect(config.workspace[0]).toEqual({
      name: 'unit',
      headless: false,
      browser: false,
      ui: true,
      parent: null,
    })

    expect(config.workspace[1]).toEqual({
      name: 'browser (chromium)',
      // headless was set in the config
      headless: true,
      browser: true,
      // UI is false because headless is enabled
      ui: false,
      parent: {
        name: 'browser',
        headless: true,
        browser: true,
        ui: false,
      },
    })
  })

  test('CLI options correctly override inline workspace options', async () => {
    const vitest = await getCliConfig({
      projects: [
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
              provider: 'playwright',
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
    expect(config.workspace[0]).toEqual({
      name: 'unit',
      headless: false,
      browser: false,
      ui: true,
      parent: null,
    })

    expect(config.workspace[1]).toEqual({
      name: 'browser (chromium)',
      // headless was overriden by CLI options
      headless: false,
      browser: true,
      // UI should be true because we always set CI to false,
      // if headless was `true`, ui would be `false`
      ui: true,
      parent: {
        name: 'browser',
        headless: false,
        browser: true,
        ui: true,
      },
    })
  })

  test('CLI options correctly override config file workspace options', async () => {
    const vitest = await getCliConfig(
      {
        projects: [
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
        'vitest.browser.config.ts': {
          test: {
            name: 'browser',
            browser: {
              enabled: true,
              headless: true,
              provider: 'playwright',
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            },
          },
        },
      },
    )

    const config = JSON.parse(vitest.stdout)

    expect(config.workspace).toHaveLength(2)
    expect(config.workspace[0]).toEqual({
      name: 'unit',
      headless: false,
      browser: false,
      ui: true,
      parent: null,
    })

    expect(config.workspace[1]).toEqual({
      name: 'browser (chromium)',
      headless: false,
      browser: true,
      ui: true,
      parent: {
        name: 'browser',
        headless: false,
        browser: true,
        ui: true,
      },
    })
  })

  test('correctly resolves extended project', async () => {
    const { stdout } = await getCliConfig({
      browser: {
        provider: 'playwright',
        headless: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
          },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            browser: {
              enabled: true,
            },
          },
        },
      ],
    }, [])

    const config = JSON.parse(stdout)

    expect(config.workspace).toHaveLength(2)
    expect(config.workspace[0]).toEqual({
      name: 'node',
      headless: true,
      browser: false,
      ui: false,
      parent: null,
    })

    expect(config.workspace[1]).toEqual({
      name: 'browser (chromium)',
      headless: true,
      browser: true,
      ui: false,
      parent: {
        name: 'browser',
        headless: true,
        browser: true,
        ui: false,
      },
    })
  })

  test('correctly overrides extended project', async () => {
    const { stdout } = await getCliConfig({
      browser: {
        provider: 'playwright',
        headless: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
          },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            browser: {
              enabled: true,
            },
          },
        },
      ],
    }, ['--browser.headless=false'])

    const config = JSON.parse(stdout)

    expect(config.workspace).toHaveLength(2)
    expect(config.workspace[0]).toEqual({
      name: 'node',
      headless: false,
      browser: false,
      ui: true,
      parent: null,
    })

    expect(config.workspace[1]).toEqual({
      name: 'browser (chromium)',
      headless: false,
      browser: true,
      ui: true,
      parent: {
        name: 'browser',
        headless: false,
        browser: true,
        ui: true,
      },
    })
  })

  test('CLI options override the config if --browser.enabled is passed down manually', async () => {
    const { stdout } = await getCliConfig({
      browser: {
        enabled: false,
        provider: 'playwright',
        headless: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
    }, ['--browser.headless=false', '--browser.enabled'])

    const config = JSON.parse(stdout)
    expect(config).toEqual({
      browser: {
        headless: false,
        browser: true,
        ui: true,
      },
      workspace: [
        {
          name: 'chromium',
          headless: false,
          browser: true,
          ui: true,
          parent: {
            name: '',
            headless: false,
            browser: true,
            ui: true,
          },
        },
      ],
    })
  })
})
