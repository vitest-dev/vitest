import { expect, test } from 'vitest'
import * as testUtils from '../../test-utils'

test.each([
  { expectedMode: 'test', command: ['run'] },
  { expectedMode: 'benchmark', command: ['bench', '--run'] },
])(`env.mode should have the $expectedMode value when running in $name mode`, async ({ command, expectedMode }) => {
  const { stdout } = await testUtils.runVitestCli(...(command), 'fixtures/mode', '-c', `fixtures/mode/vitest.${expectedMode}.config.ts`)

  expect(stdout).toContain(`✓ fixtures/mode/example.${expectedMode}.ts`)
})

test.each([
  { expectedMode: 'test', command: ['bench', '--run'], actualMode: 'benchmark' },
  { expectedMode: 'benchmark', command: ['run'], actualMode: 'test' },
])(`should return error if actual mode $actualMode is different than expected mode $expectedMode`, async ({ command, expectedMode, actualMode }) => {
  const { stdout, stderr } = await testUtils.runVitestCli(...(command), 'fixtures/mode', '-c', `fixtures/mode/vitest.${expectedMode}.config.ts`)

  expect(stderr).toContain(`env.mode:  ${actualMode}`)
  expect(stderr).toContain('Startup Error')
  expect(stderr).toContain(`Error: env.mode should be equal to "${expectedMode}"`)
  expect(stdout).toBe('')
})

test.each([
  { options: ['run'], expected: 'run' },
  { options: ['run', '--watch'], expected: 'watch' },
  { options: ['watch'], expected: 'watch' },
] as const)(`vitest $options.0 $options.1 resolves to $expected-mode`, async ({ options, expected }) => {
  const { vitest } = await testUtils.runVitestCli(...options, '--root', 'fixtures/run-mode')

  if (expected === 'watch') {
    await vitest.waitForStdout('Test Files  1 passed (1)')

    expect(vitest.stdout).not.toContain('RUN')
    expect(vitest.stdout).toContain('DEV')
    expect(vitest.stdout).toContain('Waiting for file changes')
  }

  if (expected === 'run') {
    expect(vitest.stdout).toContain('RUN')
    expect(vitest.stdout).not.toContain('DEV')
    expect(vitest.stdout).not.toContain('Waiting for file changes')
  }
})
