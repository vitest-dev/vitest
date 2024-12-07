import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('duration', async () => {
  const result = await runVitest({
    root: 'fixtures/duration',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  const output = result.stdout.replace(/\d+ms/g, '[...]ms')
  expect(output).toContain(`
 ✓ basic.test.ts > fast
 ✓ basic.test.ts > slow [...]ms
`)
})

test('prints error properties', async () => {
  const result = await runVitest({
    root: 'fixtures/error-props',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  expect(result.stderr).toContain(`Serialized Error: { code: 404, status: 'not found' }`)
})

test('prints skipped tests by default', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/all-passing-or-skipped.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(stdout).toContain('✓ fixtures/all-passing-or-skipped.test.ts (2 tests | 1 skipped)')
  expect(stdout).toContain('✓ 2 + 3 = 5')
  expect(stdout).toContain('↓ 3 + 3 = 6')
})

test('hides skipped tests when --hideSkippedTests', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/all-passing-or-skipped.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
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
    reporters: [['verbose', { isTTY: true, summary: false }]],
    retry: 3,
    config: false,
  })

  expect(stdout).toContain('1 passed')
  expect(stdout).toContain('✓ pass after retries (retry x3)')
})

test('prints repeat count', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/repeats.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(stdout).toContain('1 passed')
  expect(stdout).toContain('✓ repeat couple of times (repeat x3)')
})
