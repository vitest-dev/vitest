import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe('{ isTTY: true }', () => {
  const isTTY = true

  test('renders successful tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/ok.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('\n·\n')
    expect(stdout).toContain('Test Files  1 passed (1)')

    expect(stderr).toBe('')
  })

  test('renders failing tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/some-failing.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('\n·x\n')
    expect(stdout).toContain('Test Files  1 failed (1)')
    expect(stdout).toContain('Tests  1 failed | 1 passed')

    expect(stderr).toContain('AssertionError: expected 6 to be 7 // Object.is equality')
  })

  test('renders skipped tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/all-skipped.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('\n--\n')
    expect(stdout).toContain('Test Files  1 skipped (1)')
    expect(stdout).toContain('Tests  1 skipped | 1 todo')

    expect(stderr).toContain('')
  })
})

describe('{ isTTY: false }', () => {
  const isTTY = false

  test('renders successful tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/ok.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('✓ fixtures/ok.test.ts')
    expect(stdout).toContain('Test Files  1 passed (1)')
    expect(stdout).not.toContain('·')

    expect(stderr).toBe('')
  })

  test('renders failing tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/some-failing.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('❯ fixtures/some-failing.test.ts (2 tests | 1 failed)')
    expect(stdout).toContain('✓ 2 + 3 = 5')
    expect(stdout).toContain('× 3 + 3 = 7')
    expect(stdout).not.toContain('\n·x\n')

    expect(stdout).toContain('Test Files  1 failed (1)')
    expect(stdout).toContain('Tests  1 failed | 1 passed')

    expect(stderr).toContain('AssertionError: expected 6 to be 7 // Object.is equality')
  })

  test('renders skipped tests', async () => {
    const { stdout, stderr } = await runVitest({
      include: ['./fixtures/all-skipped.test.ts'],
      reporters: [['dot', { isTTY }]],
      typecheck: undefined,
    })

    expect(stdout).toContain('↓ fixtures/all-skipped.test.ts (2 tests | 2 skipped)')
    expect(stdout).toContain('Test Files  1 skipped (1)')
    expect(stdout).toContain('Tests  1 skipped | 1 todo')
    expect(stdout).not.toContain('\n--\n')

    expect(stderr).toContain('')
  })
})
