import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('rollup error node', async () => {
  const { stdout } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'node',
    reporters: ['junit'],
  })
  expect(stdout).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
  expect(stdout).toContain(`Plugin: vite:import-analysis`)
  expect(stdout).toContain(`Error: Failed to load url @vitejs/no-such-package`)
})

test('rollup error web', async () => {
  const { stdout } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'jsdom',
    reporters: ['junit'],
  })
  expect(stdout).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
  expect(stdout).toContain(`Plugin: vite:import-analysis`)
  expect(stdout).toContain(`Error: Failed to resolve import &quot;@vitejs/no-such-package&quot; from &quot;fixtures/rollup-error/not-found-package.test.ts&quot;. Does the file exist?`)
})
