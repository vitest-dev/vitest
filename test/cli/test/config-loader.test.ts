import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('configLoader default', async () => {
  const { vitest, exitCode } = await runVitestCli(
    'run',
    '--root',
    'fixtures/config-loader',
  )
  expect(vitest.stderr).toContain('failed to load config')
  expect(exitCode).not.toBe(0)
})

test('configLoader runner', async () => {
  const { vitest, exitCode } = await runVitestCli(
    'run',
    '--root',
    'fixtures/config-loader',
    '--configLoader',
    'runner',
  )
  expect(vitest.stderr).toBe('')
  expect(exitCode).toBe(0)
})
