import { readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('temporary files are removed after test', async () => {
  // Start from a clean reportsDirectory: `clean()` no longer sweeps other runs'
  // `.tmp*` dirs (so concurrent runs don't delete each other), so an orphan left
  // by an earlier watch-mode test in this shared cwd must not leak into the assertion.
  rmSync(resolve('./coverage'), { recursive: true, force: true })

  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: { reporter: 'json' },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).not.toContain('.tmp')

  expect(files).toMatchInlineSnapshot(`
    [
      "coverage-final.json",
    ]
  `)
})
