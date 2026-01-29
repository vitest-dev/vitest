import type { TestFsStructure } from '#test-utils'
import type { ViteUserConfig } from 'vitest/config'
import type { TestUserConfig, VitestOptions } from 'vitest/node'
import crypto from 'node:crypto'
import { runVitest, runVitestCli, useFS } from '#test-utils'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { resolve } from 'pathe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false, config: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

test('assigns names as browsers', async () => {
  const { projects } = await vitest({}, {
    browser: {
      enabled: true,
      headless: true,
      provider: preview(),
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
      provider: preview(),
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
      provider: preview(),
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

test('assigns names as browsers in a custom project', async () => {
  const { projects } = await vitest({}, {
    projects: [
      {
        test: {
          name: 'custom',
          browser: {
            enabled: true,
            headless: true,
            provider: preview(),
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
      provider: preview(),
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
          testerHtmlPath: '/custom-overridden-path.html',
          screenshotDirectory: '/custom-overridden-directory',
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
        screenshotDirectory: '/custom-overridden-directory',
        locators: {
          testIdAttribute: 'data-custom',
        },
        testerHtmlPath: '/custom-overridden-path.html',
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
        provider: playwright(),
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
            provider: playwright(),
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

test('browser instances with include/exclude/includeSource option override parent that patterns', async () => {
  const { projects } = await vitest({ config: false }, {
    include: ['**/*.global.test.{js,ts}', '**/*.shared.test.{js,ts}'],
    exclude: ['**/*.skip.test.{js,ts}'],
    includeSource: ['src/**/*.{js,ts}'],
    browser: {
      enabled: true,
      provider: preview(),
      headless: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox', include: ['test/firefox-specific.test.ts'], exclude: ['test/webkit-only.test.ts', 'test/webkit-extra.test.ts'], includeSource: ['src/firefox-compat.ts'] },
        { browser: 'webkit', include: ['test/webkit-only.test.ts', 'test/webkit-extra.test.ts'], exclude: ['test/firefox-specific.test.ts'], includeSource: ['src/webkit-compat.ts'] },
      ],
    },
  })

  // Chromium should inherit parent include/exclude/includeSource patterns (plus default test pattern)
  expect(projects[0].name).toEqual('chromium')
  expect(projects[0].config.include).toEqual([
    '**/*.global.test.{js,ts}',
    '**/*.shared.test.{js,ts}',
  ])
  expect(projects[0].config.exclude).toEqual([
    '**/*.skip.test.{js,ts}',
  ])
  expect(projects[0].config.includeSource).toEqual([
    'src/**/*.{js,ts}',
  ])

  // Firefox should only have its specific include/exclude/includeSource pattern (not parent patterns)
  expect(projects[1].name).toEqual('firefox')
  expect(projects[1].config.include).toEqual([
    'test/firefox-specific.test.ts',
  ])
  expect(projects[1].config.exclude).toEqual([
    'test/webkit-only.test.ts',
    'test/webkit-extra.test.ts',
  ])
  expect(projects[1].config.includeSource).toEqual([
    'src/firefox-compat.ts',
  ])

  // Webkit should only have its specific include/exclude/includeSource patterns (not parent patterns)
  expect(projects[2].name).toEqual('webkit')
  expect(projects[2].config.include).toEqual([
    'test/webkit-only.test.ts',
    'test/webkit-extra.test.ts',
  ])
  expect(projects[2].config.exclude).toEqual([
    'test/firefox-specific.test.ts',
  ])
  expect(projects[2].config.includeSource).toEqual([
    'src/webkit-compat.ts',
  ])
})

test('browser instances with empty include array should get parent include patterns', async () => {
  const { projects } = await vitest({ config: false }, {
    include: ['**/*.test.{js,ts}'],
    browser: {
      enabled: true,
      provider: preview(),
      headless: true,
      instances: [
        { browser: 'chromium', include: [] },
        { browser: 'firefox' },
      ],
    },
  })

  // Both instances should inherit parent include patterns when include is empty or not specified
  expect(projects[0].config.include).toEqual(['**/*.test.{js,ts}'])
  expect(projects[1].config.include).toEqual(['**/*.test.{js,ts}'])
})

test('filter for the global browser project includes all browser instances', async () => {
  const { projects } = await vitest({ project: 'myproject' }, {
    projects: [
      {
        test: {
          name: 'myproject',
          browser: {
            enabled: true,
            provider: playwright(),
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
        provider: preview(),
        headless: true,
        instances: [],
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
              provider: playwright(),
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

test('core provider has options if `provider` is playwright', async () => {
  const v = await vitest({}, {
    browser: {
      enabled: true,
      provider: playwright({ actionTimeout: 1000 }),
      instances: [
        { browser: 'chromium' },
      ],
    },
  })
  expect(v.config.browser.provider?.options).toEqual({
    actionTimeout: 1000,
  })
})

test('core provider has options if `provider` is wdio', async () => {
  const v = await vitest({}, {
    browser: {
      enabled: true,
      provider: playwright({ contextOptions: { hasTouch: true } }),
      instances: [
        { browser: 'chrome' },
      ],
    },
  })
  expect(v.config.browser.provider?.options).toEqual({
    contextOptions: { hasTouch: true },
  })
})

test('core provider has options if `provider` is preview', async () => {
  const v = await vitest({}, {
    browser: {
      enabled: true,
      provider: preview(),
      instances: [
        { browser: 'chrome' },
      ],
    },
  })
  expect(v.config.browser.provider?.options).toEqual({})
})

test('provider options can be changed dynamically', async () => {
  const v = await vitest({}, {
    browser: {
      enabled: true,
      provider: playwright({ actionTimeout: 1000 }),
      instances: [
        { browser: 'chromium' },
      ],
    },
  }, {
    plugins: [
      {
        name: 'update-options',
        configureVitest({ project }) {
          if (project.config.browser.provider) {
            const options = project.config.browser.provider.options as any
            options.actionTimeout = 400
            options.someDifferentOption = 'test'
          }
        },
      },
    ],
  })
  expect(v.config.browser.provider?.options).toEqual({
    actionTimeout: 400,
    someDifferentOption: 'test',
  })
})

test('provider options can be changed dynamically if no options are specified', async () => {
  const v = await vitest({}, {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  }, {
    plugins: [
      {
        name: 'update-options',
        configureVitest({ project }) {
          if (project.config.browser.provider) {
            const options = project.config.browser.provider.options as any
            options.actionTimeout = 400
            options.someDifferentOption = 'test'
          }
        },
      },
    ],
  })
  expect(v.config.browser.provider?.options).toEqual({
    actionTimeout: 400,
    someDifferentOption: 'test',
  })
})

test('provider options can be changed dynamically in CLI', async () => {
  const v = await vitest({
    browser: {
      provider: {
        name: 'playwright',
        _cli: true,
      } as any,
      instances: [],
    },
  }, {
    browser: {
      enabled: true,
      provider: preview(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  }, {
    plugins: [
      {
        name: 'update-options',
        configureVitest({ project }) {
          if (project.config.browser.provider) {
            const options = project.config.browser.provider.options as any
            options.actionTimeout = 400
            options.someDifferentOption = 'test'
          }
        },
      },
    ],
  })
  expect(v.config.browser.provider?.options).toEqual({
    actionTimeout: 400,
    someDifferentOption: 'test',
  })
})

test('fileParallelism on the instance works properly', async () => {
  const v = await vitest({}, {
    fileParallelism: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          fileParallelism: false,
        },
        {
          browser: 'firefox',
          fileParallelism: true,
        },
      ],
    },
  })
  expect(v.projects).toHaveLength(2)
  expect(v.projects[0].config.browser.fileParallelism).toBe(false)
  expect(v.projects[1].config.browser.fileParallelism).toBe(true)
})

test('detailsPanelPosition defaults to right', async () => {
  const { projects } = await vitest({}, {
    browser: {
      enabled: true,
      provider: preview(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  })
  expect(projects[0].config.browser.detailsPanelPosition).toBe('right')
})

test('detailsPanelPosition from config file is respected', async () => {
  const { projects } = await vitest({}, {
    browser: {
      enabled: true,
      provider: preview(),
      detailsPanelPosition: 'bottom',
      instances: [
        { browser: 'chromium' },
      ],
    },
  })
  expect(projects[0].config.browser.detailsPanelPosition).toBe('bottom')
})

test('CLI option --browser.detailsPanelPosition overrides config', async () => {
  const { projects } = await vitest({
    browser: {
      detailsPanelPosition: 'bottom',
    },
  }, {
    browser: {
      enabled: true,
      provider: playwright(),
      detailsPanelPosition: 'right',
      instances: [
        { browser: 'chromium' },
      ],
    },
  })
  expect(projects[0].config.browser.detailsPanelPosition).toBe('bottom')
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
              provider: playwright(),
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
              provider: playwright(),
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
      // headless was overridden by CLI options
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
              provider: playwright(),
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
        provider: playwright(),
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
              provider: preview(),
              instances: [],
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
        provider: playwright(),
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
              provider: preview(),
              instances: [],
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
        provider: playwright(),
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

test('browser root', async () => {
  process.env.BROWSER_DEFINE_TEST_PROEJCT = 'false'
  const { testTree, stderr } = await runVitest({
    root: './fixtures/config/browser-define',
    browser: {
      headless: true,
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "passes": "passed",
      },
    }
  `)
})

test('browser project', async () => {
  process.env.BROWSER_DEFINE_TEST_PROEJCT = 'true'
  const { testTree, stderr } = await runVitest({
    root: './fixtures/config/browser-define',
    browser: {
      headless: true,
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "passes": "passed",
      },
    }
  `)
})

const customHtmlRoot = resolve(import.meta.dirname, '../../fixtures/config/browser-custom-html')

test('throws an error with non-existing path', async () => {
  const { stderr } = await runVitest({
    root: customHtmlRoot,
    config: './vitest.config.non-existing.ts',
  }, [], { fails: true })
  expect(stderr).toContain(`Tester HTML file "${resolve(customHtmlRoot, './some-non-existing-path')}" doesn't exist.`)
})

test('throws an error and exits if there is an error in the html file hook', async () => {
  const { stderr, exitCode } = await runVitest({
    root: customHtmlRoot,
    config: './vitest.config.error-hook.ts',
  })
  expect(stderr).toContain('Error: expected error in transformIndexHtml')
  expect(stderr).toContain('[vite] Internal server error: expected error in transformIndexHtml')
  expect(exitCode).toBe(1)
})

test('allows correct custom html', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root: customHtmlRoot,
    config: './vitest.config.correct.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-basic.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml with custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root: customHtmlRoot,
    config: './vitest.config.custom-transformIndexHtml.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-custom.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml without custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root: customHtmlRoot,
    config: './vitest.config.default-transformIndexHtml.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-custom.test.ts')
  expect(exitCode).toBe(0)
})

test('show a warning if host is exposed', async () => {
  const { stderr } = await runVitest({
    config: false,
    root: './fixtures/basic',
    reporters: [
      {
        onInit() {
          throw new Error('stop')
        },
      },
    ],
    browser: {
      api: {
        host: 'custom-host',
      },
    },
  })
  expect(stderr).toContain(
    'API server is exposed to network, disabling write and exec operations by default for security reasons. This can cause some APIs to not work as expected. Set `browser.api.allowExec` manually to hide this warning. See https://vitest.dev/config/browser/api for more details.',
  )
})
