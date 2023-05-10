import { expect, test } from 'vitest'
import { version } from 'vitest/package.json'

import { runVitest } from './utils'

test('shard cannot be used with watch mode', async () => {
  const { error } = await runVitest('watch', ['--shard', '1/2'])

  expect(error).toMatch('Error: You cannot use --shard option with enabled watch')
})

test('shard must be positive number', async () => {
  const { error } = await runVitest('run', ['--shard', '"-1"'])

  expect(error).toMatch('Error: --shard <count> must be a positive number')
})

test('shard index must be smaller than count', async () => {
  const { error } = await runVitest('run', ['--shard', '2/1'])

  expect(error).toMatch('Error: --shard <index> must be a positive number less then <count>')
})

test('inspect requires changing threads or singleThread', async () => {
  const { error } = await runVitest('run', ['--inspect'])

  expect(error).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect cannot be used with threads', async () => {
  const { error } = await runVitest('run', ['--inspect', '--threads', 'true'])

  expect(error).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect-brk cannot be used with threads', async () => {
  const { error } = await runVitest('run', ['--inspect-brk', '--threads', 'true'])

  expect(error).toMatch('Error: You cannot use --inspect-brk without "threads: false" or "singleThread: true"')
})

test('c8 coverage provider cannot be used with browser', async () => {
  const { error } = await runVitest('run', ['--coverage.enabled', '--browser'])

  expect(error).toMatch('Error: @vitest/coverage-c8 does not work with --browser. Use @vitest/coverage-istanbul instead')
})

test('boolean coverage flag without dot notation, with more dot notation options', async () => {
  const { error } = await runVitest('run', ['--coverage', '--coverage.reporter', 'text'])

  expect(error).toMatch('Error: A boolean argument "--coverage" was used with dot notation arguments "--coverage.reporter".')
  expect(error).toMatch('Please specify the "--coverage" argument with dot notation as well: "--coverage.enabled"')
})

test('boolean browser flag without dot notation, with more dot notation options', async () => {
  const { error } = await runVitest('run', ['--browser', '--browser.name', 'chrome'])

  expect(error).toMatch('Error: A boolean argument "--browser" was used with dot notation arguments "--browser.name".')
  expect(error).toMatch('Please specify the "--browser" argument with dot notation as well: "--browser.enabled"')
})

test('version number is printed when coverage provider fails to load', async () => {
  const { error, output } = await runVitest('run', [
    '--coverage.enabled',
    '--coverage.provider',
    'custom',
    '--coverage.customProviderModule',
    './non-existing-module.ts',
  ])

  expect(output).toMatch(`RUN  v${version}`)
  expect(error).toMatch('Error: Failed to load custom CoverageProviderModule from ./non-existing-module.ts')
})
