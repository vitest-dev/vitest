import { expect, test } from 'vitest'

import * as testUtils from '../../test-utils'

function runVitestCli(...cliArgs: string[]) {
  return testUtils.runVitestCli('--root', 'fixtures', 'run', 'test/log-output.test.ts', ...cliArgs)
}

test('--coverage', async () => {
  const { stdout } = await runVitestCli('--coverage')

  expect(stdout).toMatch('coverage.enabled true boolean')
})

test('--coverage.all=false', async () => {
  const { stdout } = await runVitestCli('--coverage.enabled', '--coverage.all=false')

  expect(stdout).toMatch('coverage.all false boolean')
})

test('--coverage.all', async () => {
  const { stdout } = await runVitestCli('--coverage.enabled', '--coverage.all')

  expect(stdout).toMatch('coverage.all true boolean')
})
