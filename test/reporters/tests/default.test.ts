import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe('default reporter', async () => {
  test('normal', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/default',
      reporters: 'none',
    })

    expect(stdout).contain('✓ b2 passed > b2 test')
    expect(stdout).not.contain('✓ nested b1 test')
    expect(stdout).contain('× b1 failed > b failed test')
  })

  test('show full test suite when only one file', async () => {
    const { stdout } = await runVitest({
      include: ['a.test.ts'],
      root: 'fixtures/default',
      reporters: 'none',
    })

    expect(stdout).contain('✓ a passed > a1 test')
    expect(stdout).contain('✓ a passed > nested a > nested a3 test')
    expect(stdout).contain('× a failed > a failed test')
    expect(stdout).contain('nested a failed 1 test')
  })

  test('rerun should undo', async () => {
    const { vitest } = await runVitest({
      root: 'fixtures/default',
      watch: true,
      testNamePattern: 'passed',
      reporters: 'none',
    })

    // one file
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('a')
    await vitest.waitForStdout('a.test.ts')
    vitest.write('\n')
    await vitest.waitForStdout('Filename pattern: a')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(vitest.stdout).contain('✓ a passed > a1 test')
    expect(vitest.stdout).contain('✓ a passed > nested a > nested a3 test')

    // rerun and two files
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('b\n')
    await vitest.waitForStdout('Waiting for file changes...')
    expect(vitest.stdout).toContain('✓ b1.test.ts')
    expect(vitest.stdout).toContain('✓ b2.test.ts')
    expect(vitest.stdout).not.toContain('✓ nested b1 test')
    expect(vitest.stdout).not.toContain('✓ b1 test')
    expect(vitest.stdout).not.toContain('✓ b2 test')
  })

  test('doesn\'t print error properties', async () => {
    const result = await runVitest({
      root: 'fixtures/error-props',
      reporters: 'default',
      env: { CI: '1' },
    })

    expect(result.stderr).not.toContain(`Serialized Error`)
    expect(result.stderr).not.toContain(`status: 'not found'`)
  })

  test('prints queued tests as soon as they are added', async () => {
    const { stdout, vitest } = await runVitest({
      include: ['fixtures/long-loading-task.test.ts'],
      reporters: [['default', { isTTY: true, summary: true }]],
      config: 'fixtures/vitest.config.ts',
      watch: true,
    })

    await vitest.waitForStdout('❯ fixtures/long-loading-task.test.ts [queued]')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(stdout).toContain('✓ fixtures/long-loading-task.test.ts (1 test)')
  })

  test('prints skipped tests by default when a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/all-passing-or-skipped.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: 'fixtures/vitest.config.ts',
    })

    expect(stdout).toContain('✓ fixtures/all-passing-or-skipped.test.ts (2 tests | 1 skipped)')
    expect(stdout).toContain('✓ 2 + 3 = 5')
    expect(stdout).toContain('↓ 3 + 3 = 6')
  })

  test('hides skipped tests when --hideSkippedTests and a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/all-passing-or-skipped.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      hideSkippedTests: true,
      config: false,
    })

    expect(stdout).toContain('✓ fixtures/all-passing-or-skipped.test.ts (2 tests | 1 skipped)')
    expect(stdout).toContain('✓ 2 + 3 = 5')
    expect(stdout).not.toContain('↓ 3 + 3 = 6')
  })

  test('prints retry count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/retry.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      retry: 3,
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(stdout).toContain('✓ pass after retries (retry x3)')
  })

  test('prints repeat count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/repeats.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(stdout).toContain('✓ repeat couple of times (repeat x3)')
  })
}, 120000)
