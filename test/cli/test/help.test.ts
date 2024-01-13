import { expect, test } from 'vitest'

import { runVitestCli } from '../../test-utils'

const nestedRegex = /--\w+\.\w+/
test('should not show nested help options by default', async () => {
  const { stdout } = await runVitestCli('--help')
  expect(stdout).not.toMatch(nestedRegex)
})

test('should show nested help options when used with --expand-help', async () => {
  const { stdout } = await runVitestCli('--help', '--expand-help')
  expect(stdout).toMatch(nestedRegex)
})

test('should not show nested help options when used with --expand-help and another option', async () => {
  const { stdout } = await runVitestCli('--help', '--expand-help', '--run')
  expect(stdout).not.toMatch(nestedRegex)
})
