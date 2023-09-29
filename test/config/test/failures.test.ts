import { expect, test } from 'vitest'
import type { UserConfig } from 'vitest/config'
import { version } from 'vitest/package.json'

import * as testUtils from '../../test-utils'

function runVitest(config: NonNullable<UserConfig['test']> & { shard?: any }) {
  return testUtils.runVitest(config, ['fixtures/test/'])
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

test('inspect requires changing threads or singleThread', async () => {
  const { stderr } = await runVitest({ inspect: true })

  expect(stderr).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect cannot be used with threads', async () => {
  const { stderr } = await runVitest({ inspect: true, threads: true })

  expect(stderr).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect-brk cannot be used with threads', async () => {
  const { stderr } = await runVitest({ inspectBrk: true, threads: true })

  expect(stderr).toMatch('Error: You cannot use --inspect-brk without "threads: false" or "singleThread: true"')
})

test('c8 coverage provider is not supported', async () => {
  // @ts-expect-error -- check for removed API option
  const { stderr } = await runVitest({ coverage: { enabled: true, provider: 'c8' } })

  expect(stderr).toMatch('Error: "coverage.provider: c8" is not supported anymore. Use "coverage.provider: v8" instead')
})

test('v8 coverage provider cannot be used with browser', async () => {
  const { stderr } = await runVitest({ coverage: { enabled: true }, browser: { enabled: true, name: 'chrome' } })

  expect(stderr).toMatch('Error: @vitest/coverage-v8 does not work with --browser. Use @vitest/coverage-istanbul instead')
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

test('boolean coverage flag without dot notation, with more dot notation options', async () => {
  const { stderr } = await runVitestCli('--coverage', '--coverage.reporter', 'text')

  expect(stderr).toMatch('Error: A boolean argument "--coverage" was used with dot notation arguments "--coverage.reporter".')
  expect(stderr).toMatch('Please specify the "--coverage" argument with dot notation as well: "--coverage.enabled"')
})

test('boolean browser flag without dot notation, with more dot notation options', async () => {
  const { stderr } = await runVitestCli('run', '--browser', '--browser.name', 'chrome')

  expect(stderr).toMatch('Error: A boolean argument "--browser" was used with dot notation arguments "--browser.name".')
  expect(stderr).toMatch('Please specify the "--browser" argument with dot notation as well: "--browser.enabled"')
})

test('nextTick cannot be mocked inside child_process', async () => {
  const { stderr } = await runVitest({
    threads: false,
    fakeTimers: { toFake: ['nextTick'] },
    include: ['./fixtures/test/fake-timers.test.ts'],
  })

  expect(stderr).toMatch('Error: vi.useFakeTimers({ toFake: ["nextTick"] }) is not supported in node:child_process. Use --threads if mocking nextTick is required.')
})

test('nextTick can be mocked inside worker_threads', async () => {
  const { stderr } = await runVitest({
    threads: true,
    fakeTimers: { toFake: ['nextTick'] },
    include: ['./fixtures/test/fake-timers.test.ts'],
  })

  expect(stderr).not.toMatch('Error')
})
