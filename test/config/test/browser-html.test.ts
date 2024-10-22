import { expect, test } from 'vitest'
import { resolve } from 'pathe'
import { runVitest } from '../../test-utils'

const root = resolve(import.meta.dirname, '../fixtures/browser-custom-html')

test('throws an error with non-existing path', async () => {
  const { stderr, thrown } = await runVitest({
    root,
    config: './vitest.config.non-existing.ts',
  }, [], 'test', {}, { fails: true })
  expect(thrown).toBe(true)
  expect(stderr).toContain(`Tester HTML file "${resolve(root, './some-non-existing-path')}" doesn't exist.`)
})

test('throws an error and exits if there is an error in the html file hook', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.error-hook.ts',
  })
  expect(stderr).toContain('expected error in transformIndexHtml')
  // error happens when browser is opened
  expect(stdout).toContain('Browser runner started by playwright')
  expect(exitCode).toBe(1)
})

test('allows correct custom html', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.correct.ts',
    reporters: ['basic'],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('Browser runner started by playwright')
  expect(stdout).toContain('✓ browser-basic.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml with custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.custom-transformIndexHtml.ts',
    reporters: ['basic'],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('Browser runner started by playwright')
  expect(stdout).toContain('✓ browser-custom.test.ts')
  expect(exitCode).toBe(0)
})

test('allows custom transformIndexHtml without custom html file', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root,
    config: './vitest.config.default-transformIndexHtml.ts',
    reporters: ['basic'],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('Browser runner started by playwright')
  expect(stdout).toContain('✓ browser-custom.test.ts')
  expect(exitCode).toBe(0)
})
