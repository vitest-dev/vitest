import { runVitest } from '#test-utils'
import { describe, expect, test } from 'vitest'

describe.each([true, false])('{ isTTY: %s }', (isTTY) => {
  test('renders successful tests', async () => {
    const { stdout, stderr } = await runVitest({
      root: './fixtures/reporters',
      include: ['./ok.test.ts'],
      reporters: [['dot', { isTTY }]],
    })

    expect(stdout).toContain('\n·\n')
    expect(stdout).toContain('Test Files  1 passed (1)')

    expect(stderr).toBe('')
  })

  test('renders failing tests', async () => {
    const { stdout, stderr } = await runVitest({
      root: './fixtures/reporters',
      include: ['./some-failing.test.ts'],
      reporters: [['dot', { isTTY }]],
    })

    expect(stdout).toContain('\n·x\n')
    expect(stdout).toContain('Test Files  1 failed (1)')
    expect(stdout).toContain('Tests  1 failed | 1 passed')

    expect(stderr).toContain('AssertionError: expected 6 to be 7 // Object.is equality')
  })

  test('renders skipped tests', async () => {
    const { stdout, stderr } = await runVitest({
      root: './fixtures/reporters',
      include: ['./all-skipped.test.ts'],
      reporters: [['dot', { isTTY }]],
    })

    expect(stdout).toContain('\n--\n')
    expect(stdout).toContain('Test Files  1 skipped (1)')
    expect(stdout).toContain('Tests  1 skipped | 1 todo')

    expect(stderr).toContain('')
  })
})
