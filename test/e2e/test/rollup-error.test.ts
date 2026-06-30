import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'

test('rollup error node', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'node',
  })
  if (rolldownVersion) {
    expect(stderr).toContain('"./no-such-export" is not exported')
    expect(stderr).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(stderr).toContain(`Error: Missing "./no-such-export" specifier in "vite" package`)
    expect(stderr).toContain(`Plugin: vite:import-analysis`)
  }
  expect(stderr).toContain(`Error: Cannot find package '@vitejs/no-such-package'`)
})

test('rollup error web', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/rollup-error',
    environment: 'jsdom',
  })
  if (rolldownVersion) {
    expect(stderr).toContain('"./no-such-export" is not exported')
    expect(stderr).toContain(`Plugin: builtin:vite-resolve`)
  }
  else {
    expect(stderr).toContain(`Error: Missing "./no-such-export" specifier in "vite" package`)
  }
  expect(stderr).toContain(`Plugin: vite:import-analysis`)
  expect(stderr).toContain(`Error: Failed to resolve import "@vitejs/no-such-package" from "fixtures/rollup-error/not-found-package.test.ts". Does the file exist?`)
})
