import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'

test('rollup error node', async () => {
  const { stdout } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'node',
    reporters: ['junit'],
  })
  if (rolldownVersion) {
    expect(stdout).toContain('&quot;./no-such-export&quot; is not exported')
    expect(stdout).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(stdout).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
    expect(stdout).toContain(`Plugin: vite:import-analysis`)
  }
  expect(stdout).toContain(`Error: Cannot find package &apos;@vitejs/no-such-package&apos;`)
})

test('rollup error web', async () => {
  const { stdout } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'jsdom',
    reporters: ['junit'],
  })
  if (rolldownVersion) {
    expect(stdout).toContain('&quot;./no-such-export&quot; is not exported')
    expect(stdout).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(stdout).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
  }
  expect(stdout).toContain(`Plugin: vite:import-analysis`)
  expect(stdout).toContain(`Error: Failed to resolve import &quot;@vitejs/no-such-package&quot; from &quot;fixtures/rollup-error/not-found-package.test.ts&quot;. Does the file exist?`)
})
