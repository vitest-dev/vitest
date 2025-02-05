import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('cursor is hidden during test run in TTY', async () => {
  const { stdout } = await runVitest({
    include: ['b1.test.ts'],
    root: 'fixtures/default',
    reporters: 'none',
    watch: false,
  }, undefined, undefined, undefined, { tty: true, preserveAnsi: true })

  expect(stdout).toContain('\x1B[?25l')
  expect(stdout).toContain('\x1B[?25h')
})

test('cursor is not hidden during test run in non-TTY', async () => {
  const { stdout } = await runVitest({
    include: ['b1.test.ts'],
    root: 'fixtures/default',
    reporters: 'none',
    watch: false,
  }, undefined, undefined, undefined, { preserveAnsi: true })

  expect(stdout).not.toContain('\x1B[?25l')
  expect(stdout).not.toContain('\x1B[?25h')
})
