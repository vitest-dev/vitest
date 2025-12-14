import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('tests are repeating using cli args', async () => {
  const {
    stdout,
  } = await runVitestCli('run', '--root', 'fixtures/repeats', '--repeats', '3', '--reporter', 'verbose')
  expect(stdout).toContain('(repeat x3)')
  expect(stdout).toContain('(repeat x2)')
})
