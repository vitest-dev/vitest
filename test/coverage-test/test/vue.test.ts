import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

// runVitest startup completes in <2s in the green path but exceeds the 10s
// default on Cache&Test: windows under load; 20s leaves headroom without
// stretching the fail window unnecessarily.
const HOOK_TIMEOUT_MS = 20_000

beforeAll(async () => {
  const start = Date.now()
  process.stderr.write(`[flake-dbg] vue.test beforeAll start\n`)
  try {
    await runVitest({
      include: ['fixtures/test/vue-fixture.test.ts'],
      coverage: { reporter: ['json', 'html'] },
    })
    process.stderr.write(`[flake-dbg] vue.test beforeAll done in ${Date.now() - start}ms\n`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[flake-dbg] vue.test beforeAll failed after ${Date.now() - start}ms: ${message}\n`)
    throw error
  }
}, HOOK_TIMEOUT_MS)

test('files should not contain query parameters', () => {
  const coveragePath = resolve('./coverage/Vue/Counter/')
  const files = readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('Counter.vue.html')
  expect(files).toContain('Counter.component.ts.html')
  expect(files).not.toContain('Counter.component.ts?vue&type=script&src=true&lang.ts.html')
})

test('coverage results matches snapshot', async () => {
  const coverageMap = await readCoverageMap()

  expect(coverageMap).toMatchInlineSnapshot(`
    {
      "branches": "6/8 (75%)",
      "functions": "5/7 (71.42%)",
      "lines": "13/16 (81.25%)",
      "statements": "14/17 (82.35%)",
    }
  `)
})
