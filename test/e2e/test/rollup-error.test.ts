import { runVitest } from '#test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'

function readJunitReport(reportRoot: string) {
  return readFileSync(resolve(reportRoot, '.vitest/junit/output.xml'), 'utf-8')
}

test('rollup error node', async () => {
  const { ctx } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'node',
    reporters: ['junit'],
  })
  const xml = readJunitReport(ctx!.config.root)
  if (rolldownVersion) {
    expect(xml).toContain('&quot;./no-such-export&quot; is not exported')
    expect(xml).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(xml).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
    expect(xml).toContain(`Plugin: vite:import-analysis`)
  }
  expect(xml).toContain(`Error: Cannot find package &apos;@vitejs/no-such-package&apos;`)
})

test('rollup error web', async () => {
  const { ctx } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'jsdom',
    reporters: ['junit'],
  })
  const xml = readJunitReport(ctx!.config.root)
  if (rolldownVersion) {
    expect(xml).toContain('&quot;./no-such-export&quot; is not exported')
    expect(xml).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(xml).toContain(`Error: Missing &quot;./no-such-export&quot; specifier in &quot;vite&quot; package`)
  }
  expect(xml).toContain(`Plugin: vite:import-analysis`)
  expect(xml).toContain(`Error: Failed to resolve import &quot;@vitejs/no-such-package&quot; from &quot;fixtures/rollup-error/not-found-package.test.ts&quot;. Does the file exist?`)
})
