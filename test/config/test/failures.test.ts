import type { UserConfig } from 'vitest/node'
import type { VitestRunnerCLIOptions } from '../../test-utils'
import { normalize, resolve } from 'pathe'

import { beforeEach, expect, test } from 'vitest'
import { version } from 'vitest/package.json'
import * as testUtils from '../../test-utils'

const providers = ['playwright', 'webdriverio', 'preview'] as const
const names = ['edge', 'chromium', 'webkit', 'chrome', 'firefox', 'safari'] as const
const browsers = providers.map(provider => names.map(name => ({ name, provider }))).flat()

function runVitest(config: NonNullable<UserConfig> & { shard?: any }, runnerOptions?: VitestRunnerCLIOptions) {
  return testUtils.runVitest({ root: './fixtures/test', ...config }, [], undefined, {}, runnerOptions)
}

function runVitestCli(...cliArgs: string[]) {
  return testUtils.runVitestCli('run', 'fixtures/test/', ...cliArgs)
}

beforeEach((ctx) => {
  const errors: Parameters<typeof console.error>[] = []
  const original = console.error
  console.error = (...args) => errors.push(args)

  ctx.onTestFailed(() => {
    errors.forEach(args => original(...args))
  })

  return () => {
    console.error = original
  }
})

test('shard cannot be used with watch mode', async () => {
  const { stderr } = await runVitest({ watch: true, shard: '1/2' })

  expect(stderr).toMatch('Error: You cannot use --shard option with enabled watch')
})

test('shard must be positive number', async () => {
  const { stderr } = await runVitest({ shard: '-1' })

  expect(stderr).toMatch('Error: --shard <count> must be a positive number')
})

test('shard index must be smaller than count', async () => {
  const { stderr } = await runVitest({ shard: '2/1' })

  expect(stderr).toMatch('Error: --shard <index> must be a positive number less then <count>')
})

test('inspect requires changing pool and singleThread/singleFork', async () => {
  const { stderr } = await runVitest({ inspect: true })

  expect(stderr).toMatch('Error: You cannot use --inspect without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('inspect cannot be used with multi-threading', async () => {
  const { stderr } = await runVitest({ inspect: true, pool: 'threads', poolOptions: { threads: { singleThread: false } } })

  expect(stderr).toMatch('Error: You cannot use --inspect without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('inspect in browser mode requires no-file-parallelism', async () => {
  const { stderr } = await runVitest({ inspect: true, browser: { enabled: true, name: 'chromium', provider: 'playwright' } })

  expect(stderr).toMatch('Error: You cannot use --inspect without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('inspect-brk cannot be used with multi processing', async () => {
  const { stderr } = await runVitest({ inspect: true, pool: 'forks', poolOptions: { forks: { singleFork: false } } })

  expect(stderr).toMatch('Error: You cannot use --inspect without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('inspect-brk in browser mode requires no-file-parallelism', async () => {
  const { stderr } = await runVitest({ inspectBrk: true, browser: { enabled: true, name: 'chromium', provider: 'playwright' } })

  expect(stderr).toMatch('Error: You cannot use --inspect-brk without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('inspect and --inspect-brk cannot be used when not playwright + chromium', async () => {
  for (const option of ['inspect', 'inspectBrk']) {
    const cli = `--inspect${option === 'inspectBrk' ? '-brk' : ''}`

    for (const { provider, name } of browsers) {
      if (provider === 'playwright' && name === 'chromium') {
        continue
      }

      const { stderr } = await runVitest({
        [option]: true,
        fileParallelism: false,
        browser: {
          enabled: true,
          provider,
          name,
        },
      })

      expect(stderr).toMatch(
        `Error: ${cli} does not work with
{
  "browser": {
    "provider": "${provider}",
    "name": "${name}"
  }
}

Use either:
{
  "browser": {
    "provider": "playwright",
    "instances": [
      {
        "browser": "chromium"
      }
    ]
  }
}

...or disable ${cli}
`,
      )
    }
  }
})

test('v8 coverage provider throws when not playwright + chromium (browser.name)', async () => {
  for (const { provider, name } of browsers) {
    if (provider === 'playwright' && name === 'chromium') {
      continue
    }

    const { stderr } = await runVitest({
      coverage: {
        enabled: true,
      },
      browser: {
        enabled: true,
        provider,
        name,
      },
    })

    expect(stderr).toMatch(
      `Error: @vitest/coverage-v8 does not work with
{
  "browser": {
    "provider": "${provider}",
    "name": "${name}"
  }
}

Use either:
{
  "browser": {
    "provider": "playwright",
    "instances": [
      {
        "browser": "chromium"
      }
    ]
  }
}

...or change your coverage provider to:
{
  "coverage": {
    "provider": "istanbul"
  }
}
`,
    )
  }
})

test('v8 coverage provider throws when not playwright + chromium (browser.instances)', async () => {
  for (const { provider, name } of browsers) {
    if (provider === 'playwright' && name === 'chromium') {
      continue
    }

    const { stderr } = await runVitest({
      coverage: {
        enabled: true,
      },
      browser: {
        enabled: true,
        provider,
        instances: [{ browser: name }],
      },
    })

    expect(stderr).toMatch(
      `Error: @vitest/coverage-v8 does not work with
{
  "browser": {
    "provider": "${provider}",
    "instances": [
      {
        "browser": "${name}"
      }
    ]
  }
}

Use either:
{
  "browser": {
    "provider": "playwright",
    "instances": [
      {
        "browser": "chromium"
      }
    ]
  }
}

...or change your coverage provider to:
{
  "coverage": {
    "provider": "istanbul"
  }
}
`,
    )
  }
})

test('v8 coverage provider throws when using chromium and other non-chromium browser', async () => {
  const { stderr } = await runVitest({
    coverage: {
      enabled: true,
    },
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  })

  expect(stderr).toMatch(
    `Error: @vitest/coverage-v8 does not work with
{
  "browser": {
    "provider": "playwright",
    "instances": [
      {
        "browser": "chromium"
      },
      {
        "browser": "firefox"
      },
      {
        "browser": "webkit"
      }
    ]
  }
}

Use either:
{
  "browser": {
    "provider": "playwright",
    "instances": [
      {
        "browser": "chromium"
      }
    ]
  }
}

...or change your coverage provider to:
{
  "coverage": {
    "provider": "istanbul"
  }
}`,
  )
})

test('v8 coverage provider cannot be used in workspace without playwright + chromium', async () => {
  const { stderr } = await runVitest({
    coverage: { enabled: true },
    workspace: './fixtures/workspace/browser/workspace-with-browser.ts',
  }, { fails: true })
  expect(stderr).toMatch(
    `Error: @vitest/coverage-v8 does not work with
    {
      "browser": {
        "provider": "webdriverio",
        "instances": [
          {
            "browser": "chrome"
          }
        ]
      }
    }`,
  )
})

test('coverage reportsDirectory cannot be current working directory', async () => {
  const { stderr } = await runVitest({
    root: undefined,
    coverage: {
      enabled: true,
      reportsDirectory: './',

      // Additional options to make sure this test doesn't accidentally remove whole vitest project
      clean: false,
      cleanOnRerun: false,
      provider: 'custom',
      customProviderModule: 'non-existing-provider-so-that-reportsDirectory-is-not-removed',
    },
  })

  const directory = normalize(resolve('./'))
  expect(stderr).toMatch(`Error: You cannot set "coverage.reportsDirectory" as ${directory}. Vitest needs to be able to remove this directory before test run`)
})

test('coverage reportsDirectory cannot be root', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/test',
    coverage: {
      enabled: true,
      reportsDirectory: './',

      // Additional options to make sure this test doesn't accidentally remove whole vitest project
      clean: false,
      cleanOnRerun: false,
      provider: 'custom',
      customProviderModule: 'non-existing-provider-so-that-reportsDirectory-is-not-removed',
    },
  })

  const directory = normalize(resolve('./fixtures/test'))
  expect(stderr).toMatch(`Error: You cannot set "coverage.reportsDirectory" as ${directory}. Vitest needs to be able to remove this directory before test run`)
})

test('version number is printed when coverage provider fails to load', async () => {
  const { stderr, stdout } = await runVitest({
    coverage: {
      enabled: true,
      provider: 'custom',
      customProviderModule: './non-existing-module.ts',
    },
  })

  expect(stdout).toMatch(`RUN  v${version}`)
  expect(stderr).toMatch('Error: Failed to load custom CoverageProviderModule from')
  expect(stderr).toMatch('non-existing-module.ts')
})

test('coverage.autoUpdate cannot update thresholds when configuration file doesnt define them', async () => {
  const { stderr } = await runVitest({
    coverage: {
      enabled: true,
      thresholds: {
        autoUpdate: true,
        lines: 0,
      },
    },
  })

  expect(stderr).toMatch('Error: Unable to parse thresholds from configuration file: Expected config.test.coverage.thresholds to be an object')
})

test('boolean flag 100 should not crash CLI', async () => {
  let { stderr } = await runVitestCli('--coverage.enabled', '--coverage.thresholds.100')
  // non-zero coverage shows up, which is non-deterministic, so strip it.
  stderr = stderr.replace(/\([0-9.]+%\) does/g, '(0%) does')

  expect(stderr).toMatch('ERROR: Coverage for lines (0%) does not meet global threshold (100%)')
  expect(stderr).toMatch('ERROR: Coverage for functions (0%) does not meet global threshold (100%)')
  expect(stderr).toMatch('ERROR: Coverage for statements (0%) does not meet global threshold (100%)')
  expect(stderr).toMatch('ERROR: Coverage for branches (0%) does not meet global threshold (100%)')
})

test('nextTick cannot be mocked inside child_process', async () => {
  const { stderr } = await runVitest({
    fakeTimers: { toFake: ['nextTick'] },
    include: ['./fake-timers.test.ts'],
  })

  expect(stderr).toMatch('Error: vi.useFakeTimers({ toFake: ["nextTick"] }) is not supported in node:child_process. Use --pool=threads if mocking nextTick is required.')
})

test('nextTick can be mocked inside worker_threads', async () => {
  const { stderr } = await runVitest({
    pool: 'threads',
    fakeTimers: { toFake: ['nextTick'] },
    include: ['./fixtures/test/fake-timers.test.ts'],
  })

  expect(stderr).not.toMatch('Error')
})

test('mergeReports doesn\'t work with watch mode enabled', async () => {
  const { stderr } = await runVitest({ watch: true, mergeReports: '.vitest-reports' })

  expect(stderr).toMatch('Cannot merge reports with --watch enabled')
})

test('maxConcurrency 0 prints a warning', async () => {
  const { stderr, ctx } = await runVitest({ maxConcurrency: 0 })

  expect(ctx?.config.maxConcurrency).toBe(5)
  expect(stderr).toMatch('The option "maxConcurrency" cannot be set to 0. Using default value 5 instead.')
})

test('browser.instances is empty', async () => {
  const { stderr } = await runVitest({
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [],
    },
  })
  expect(stderr).toMatch('"browser.instances" was set in the config, but the array is empty. Define at least one browser config.')
})

test('browser.name filteres all browser.instances are required', async () => {
  const { stderr } = await runVitest({
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      instances: [
        { browser: 'firefox' },
      ],
    },
  })
  expect(stderr).toMatch('"browser.instances" was set in the config, but the array is empty. Define at least one browser config. The "browser.name" was set to "chromium" which filtered all configs (firefox). Did you mean to use another name?')
})

test('browser.instances throws an error if no custom name is provided', async () => {
  const { stderr } = await runVitest({
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        { browser: 'firefox' },
        { browser: 'firefox' },
      ],
    },
  })
  expect(stderr).toMatch('Cannot define a nested project for a firefox browser. The project name "firefox" was already defined. If you have multiple instances for the same browser, make sure to define a custom "name". All projects in a workspace should have unique names. Make sure your configuration is correct.')
})

test('browser.instances throws an error if no custom name is provided, but the config name is inherited', async () => {
  const { stderr } = await runVitest({
    name: 'custom',
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        { browser: 'firefox' },
        { browser: 'firefox' },
      ],
    },
  })
  expect(stderr).toMatch('Cannot define a nested project for a firefox browser. The project name "custom (firefox)" was already defined. If you have multiple instances for the same browser, make sure to define a custom "name". All projects in a workspace should have unique names. Make sure your configuration is correct.')
})

test('throws an error if name conflicts with a workspace name', async () => {
  const { stderr } = await runVitest({
    workspace: [
      { test: { name: '1 (firefox)' } },
      {
        test: {
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [
              { browser: 'firefox' },
            ],
          },
        },
      },
    ],
  })
  expect(stderr).toMatch('Cannot define a nested project for a firefox browser. The project name "1 (firefox)" was already defined. If you have multiple instances for the same browser, make sure to define a custom "name". All projects in a workspace should have unique names. Make sure your configuration is correct.')
})

test('throws an error if several browsers are headed in nonTTY mode', async () => {
  const { stderr } = await runVitest({
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: false,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
      ],
    },
  })
  expect(stderr).toContain('Found multiple projects that run browser tests in headed mode: "chromium", "firefox"')
  expect(stderr).toContain('Please, filter projects with --browser=name or --project=name flag or run tests with "headless: true" option')
})

test('non existing project name will throw', async () => {
  const { stderr } = await runVitest({ project: 'non-existing-project' })
  expect(stderr).toMatch('No projects matched the filter "non-existing-project".')
})

test('non existing project name array will throw', async () => {
  const { stderr } = await runVitest({ project: ['non-existing-project', 'also-non-existing'] })
  expect(stderr).toMatch('No projects matched the filter "non-existing-project", "also-non-existing".')
})
