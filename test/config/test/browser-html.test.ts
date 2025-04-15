import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(import.meta.dirname, '../fixtures/browser-custom-html')

test('throws an error with non-existing path', async () => {
  const { stderr } = await runVitest({
    root,
    config: './vitest.config.non-existing.ts',
  }, [], 'test', {}, { fails: true })
  expect(stderr).toContain(`Tester HTML file "${resolve(root, './some-non-existing-path')}" doesn't exist.`)
})

test('throws an error and exits if there is an error in the html file hook', async () => {
  const { stderr, exitCode } = await runVitest({
    root,
    config: './vitest.config.error-hook.ts',
  })
  expect(stderr).toContain('Error: expected error in transformIndexHtml')
  expect(stderr).toContain('[vite] Internal server error: expected error in transformIndexHtml')
  expect(exitCode).toBe(1)
})

test('allows correct custom html', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.correct.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-basic.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml with custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.custom-transformIndexHtml.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-custom.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml without custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.default-transformIndexHtml.ts',
    reporters: [['default', { summary: false }]],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('✓ |chromium| browser-custom.test.ts')
  expect(exitCode).toBe(0)
})
