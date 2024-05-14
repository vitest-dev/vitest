import { expect, test } from 'vitest'
import type { UserConfig } from 'vitest/config'
import { version } from 'vitest/package.json'

import { normalize, resolve } from 'pathe'
import * as testUtils from '../../test-utils'

function runVitest(config: NonNullable<UserConfig['test']> & { shard?: any }) {
  return testUtils.runVitest({ root: './fixtures/test', ...config }, [])
}

function runVitestCli(...cliArgs: string[]) {
  return testUtils.runVitestCli('run', 'fixtures/test/', ...cliArgs)
}

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

test('inspect-brk cannot be used with multi processing', async () => {
  const { stderr } = await runVitest({ inspect: true, pool: 'forks', poolOptions: { forks: { singleFork: false } } })

  expect(stderr).toMatch('Error: You cannot use --inspect without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"')
})

test('v8 coverage provider cannot be used with browser', async () => {
  const { stderr } = await runVitest({ coverage: { enabled: true }, browser: { enabled: true, name: 'chrome' } })

  expect(stderr).toMatch('Error: @vitest/coverage-v8 does not work with --browser. Use @vitest/coverage-istanbul instead')
})

test('v8 coverage provider cannot be used with browser in workspace', async () => {
  const { stderr } = await runVitest({ coverage: { enabled: true }, workspace: './fixtures/workspace/browser/workspace-with-browser.ts' })

  expect(stderr).toMatch('Error: @vitest/coverage-v8 does not work with --browser. Use @vitest/coverage-istanbul instead')
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
  expect(stderr).toMatch('Error: Failed to load custom CoverageProviderModule from ./non-existing-module.ts')
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
  const { stderr } = await runVitestCli('--coverage.enabled', '--coverage.thresholds.100')

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
