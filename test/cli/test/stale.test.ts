import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { editFile, resolvePath, runVitest } from '../../test-utils'

const fixtureRoot = resolvePath(import.meta.url, '../fixtures/stale')

function clearStaleCache() {
  const cacheDir = resolve(fixtureRoot, 'node_modules')
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true })
  }
}

function normalizeOutput(stdout: string) {
  const rows = stdout.replace(/\d?\.?\d+m?s/g, '[...]ms').split('\n').map((row) => {
    if (row.includes('RUN  v')) {
      return `${row.split('RUN  v')[0]}RUN  v[...]`
    }

    if (row.includes('Start at')) {
      return row.replace(/\d+:\d+:\d+/, '[...]')
    }
    return row
  })

  return rows.join('\n').trim()
}

async function runStale() {
  return runVitest({
    root: './fixtures/stale',
    stale: true,
    cache: undefined,
  })
}

describe.skipIf(process.env.ECOSYSTEM_CI)('--stale', () => {
  beforeEach(() => {
    clearStaleCache()
  })

  it('runs all tests on first run when no manifest exists', async () => {
    const { stdout, stderr } = await runStale()
    expect(stderr).toBe('')
    expect(normalizeOutput(stdout)).toMatchInlineSnapshot(`
      "RUN  v[...]

       ✓ test-a.test.ts > a [...]ms
       ✓ test-b.test.ts > b [...]ms
       ✓ test-standalone.test.ts > standalone [...]ms

       Test Files  3 passed (3)
            Tests  3 passed (3)
         Start at  [...]
         Duration  [...]ms (transform [...]ms, setup [...]ms, import [...]ms, tests [...]ms, environment [...]ms)"
    `)
  })

  it('runs no tests on second run with no changes', async () => {
    await runStale()
    const { stdout } = await runStale()
    expect(normalizeOutput(stdout)).toMatchInlineSnapshot(`
      "RUN  v[...]

      No test files found, exiting with code 0"
    `)
  })

  it('runs only affected test when source dependency changes', async () => {
    await runStale()
    editFile(
      resolvePath(import.meta.url, '../fixtures/stale/source-a.ts'),
      content => `${content}\n`,
    )
    const { stdout, stderr } = await runStale()
    expect(stderr).toBe('')
    expect(normalizeOutput(stdout)).toMatchInlineSnapshot(`
      "RUN  v[...]

       ✓ test-a.test.ts > a [...]ms

       Test Files  1 passed (1)
            Tests  1 passed (1)
         Start at  [...]
         Duration  [...]ms (transform [...]ms, setup [...]ms, import [...]ms, tests [...]ms, environment [...]ms)"
    `)
  })

  it('runs only affected test when transitive dependency changes', async () => {
    await runStale()
    editFile(
      resolvePath(import.meta.url, '../fixtures/stale/dep-of-a.ts'),
      content => `${content}\n`,
    )
    const { stdout, stderr } = await runStale()
    expect(stderr).toBe('')
    expect(normalizeOutput(stdout)).toMatchInlineSnapshot(`
      "RUN  v[...]

       ✓ test-a.test.ts > a [...]ms

       Test Files  1 passed (1)
            Tests  1 passed (1)
         Start at  [...]
         Duration  [...]ms (transform [...]ms, setup [...]ms, import [...]ms, tests [...]ms, environment [...]ms)"
    `)
  })

  it('errors when both --stale and --changed are used', async () => {
    const { stderr } = await runVitest({
      root: './fixtures/stale',
      stale: true,
      changed: true,
      cache: undefined,
    })
    expect(stderr.split('\n')[0]).toMatchInlineSnapshot(`"Error: Cannot use both --stale and --changed options at the same time"`)
  })

  it('runs only changed test when test file itself changes', async () => {
    await runStale()
    editFile(
      resolvePath(import.meta.url, '../fixtures/stale/test-standalone.test.ts'),
      content => `${content}\n`,
    )
    const { stdout, stderr } = await runStale()
    expect(stderr).toBe('')
    expect(normalizeOutput(stdout)).toMatchInlineSnapshot(`
      "RUN  v[...]

       ✓ test-standalone.test.ts > standalone [...]ms

       Test Files  1 passed (1)
            Tests  1 passed (1)
         Start at  [...]
         Duration  [...]ms (transform [...]ms, setup [...]ms, import [...]ms, tests [...]ms, environment [...]ms)"
    `)
  })
})
